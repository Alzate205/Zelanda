'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Layers, Plane, Satellite, Scan } from 'lucide-react';
import Mapa3D, { type LoteMapa3D, type ManijaMapa3D, type ModoMapa } from './Mapa3D';
import { ChipsModos } from './ChipsModos';
import { DockKPIs } from './DockKPIs';
import { PanelLote } from './PanelLote';
import { VueloDron } from './VueloDron';
import { PanelClima } from './PanelClima';
import type { ClimaFinca } from '@/lib/jefe/clima';
import { useSnapshotJefe } from '@/hooks/useSnapshotJefe';
import { ordenarPorCercania } from '@/lib/ruta-dron';
import { centroVisualDePoligono, rampaCosecha, type EstadoLote } from '@/lib/mapa3d';
import { asignarColoresLotes } from '@/lib/paleta-lotes';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { EVENTO_ABRIR_PANEL } from '@/components/shared/BotonPanel';
import type { SnapshotJefe } from '@/lib/offline/tipos';
import type { GeoFinca } from '@/lib/geo-finca';

// Fallback Leaflet: solo se descarga si el dispositivo no tiene WebGL.
const MapaFincaFallback = dynamic(() => import('@/components/mapa/MapaFinca'), {
  ssr: false,
});

// El panel del jefe se carga aparte: es una pantalla entera de datos que antes
// viajaba y se parseaba junto con el mapa aunque no se abriera nunca.
const PanelCentral = dynamic(() => import('./PanelCentral').then((m) => m.PanelCentral), {
  ssr: false,
});

/** Recuerda si el jefe dejó los lotes apagados, igual que se recuerda la cámara. */
const CLAVE_LOTES_VISIBLES = 'zelanda_mapa_lotes_visibles';

// El resultado no cambia durante la vida de la página, y volver a preguntarlo
// costaba caro (ver abajo). Se pregunta una vez y se recuerda.
let soportaWebGLCache: boolean | null = null;

/**
 * ¿Este dispositivo puede con el mapa 3D?
 *
 * El bug: la versión anterior creaba un canvas, le pedía un contexto WebGL para
 * ver si contestaba... y lo dejaba vivo. iOS limita cuántos contextos WebGL
 * pueden existir a la vez —son pocos, y menos todavía con poca memoria— y al
 * llegar al tope `getContext` empieza a devolver null.
 *
 * O sea que cada visita al centro de control se quedaba con un contexto para
 * siempre, y después de unas cuantas idas y vueltas la prueba empezaba a fallar
 * y el iPhone caía al mapa 2D de forma permanente. No tenía que ver con cuántos
 * lotes hubiera: tenía que ver con cuántas veces se había entrado. Por eso
 * "antes se veía en 3D y ahora no", y por eso volvía si se cerraba la pestaña.
 *
 * Ahora el contexto de prueba se devuelve apenas se usa.
 */
function soportaWebGL(): boolean {
  if (soportaWebGLCache !== null) return soportaWebGLCache;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (ctx) {
      // Devolver el contexto es lo único que impide que la prueba se convierta
      // en la causa del problema que intenta detectar.
      (ctx.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
    }
    soportaWebGLCache = Boolean(ctx);
  } catch {
    soportaWebGLCache = false;
  }
  return soportaWebGLCache;
}

// Leyenda del NDVI: mismos colores que el evalscript de lib/jefe/ndvi.ts.
const LEYENDA_NDVI = [
  { color: '#15733a', etiqueta: 'Muy sano' },
  { color: '#8cc759', etiqueta: 'Sano' },
  { color: '#f2d94d', etiqueta: 'Medio' },
  { color: '#e58c33', etiqueta: 'Bajo' },
  { color: '#bf382b', etiqueta: 'Estrés / suelo' },
];

// Botones redondos de acción sobre el mapa
const BTN_MAPA =
  'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-zelanda-beige-50/85 text-zelanda-verde-800 shadow-suave backdrop-blur-md';
const BTN_MAPA_ACTIVO =
  'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-zelanda-verde-700 text-zelanda-beige-50 shadow-card';

/** Por debajo de esto el mapa no sirve de nada; encima de esto, tapa la pantalla. */
const ALTO_MINIMO_MAPA = 240;

const FORMATEADOR_FECHA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Bogota',
});

export function CentroControl({
  nombrePila,
  saludo,
  snapshotInicial,
  geo,
}: {
  nombrePila: string;
  saludo: string;
  snapshotInicial: SnapshotJefe;
  geo: GeoFinca;
}) {
  const { snapshot, tsCache } = useSnapshotJefe(snapshotInicial);
  const [modo, setModo] = useState<ModoMapa>('tareas');
  const [loteId, setLoteId] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  // El botón del header abre el panel: por evento si ya estamos acá, o con
  // `?panel=1` cuando venimos navegando desde otra pantalla.
  useEffect(() => {
    const abrir = () => setPanelAbierto(true);
    window.addEventListener(EVENTO_ABRIR_PANEL, abrir);
    if (new URLSearchParams(window.location.search).get('panel') === '1') abrir();
    return () => window.removeEventListener(EVENTO_ABRIR_PANEL, abrir);
  }, []);

  const [conWebGL, setConWebGL] = useState<boolean | null>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState<number | null>(null);
  const [vuelo, setVuelo] = useState<{
    ruta: string[];
    indice: number;
    pausado: boolean;
  } | null>(null);
  const mapaRef = useRef<ManijaMapa3D>(null);
  const [clima, setClima] = useState<ClimaFinca | 'error' | null>(null);
  const [ndvi, setNdvi] = useState<{
    url: string;
    bbox: [number, number, number, number];
  } | null>(null);
  const [avisoNdvi, setAvisoNdvi] = useState<string | null>(null);
  // Arranca en true y se corrige al montar: leer localStorage durante el
  // render rompe la hidratación, porque en el servidor no existe.
  const [lotesVisibles, setLotesVisibles] = useState(true);

  useEffect(() => {
    setConWebGL(soportaWebGL());
    try {
      if (localStorage.getItem(CLAVE_LOTES_VISIBLES) === '0') setLotesVisibles(false);
    } catch {
      // localStorage bloqueado: se muestran los lotes, que es lo normal.
    }
  }, []);

  function alternarLotes() {
    setLotesVisibles((visible) => {
      const nuevo = !visible;
      try {
        localStorage.setItem(CLAVE_LOTES_VISIBLES, nuevo ? '1' : '0');
      } catch {
        // No poder recordarlo no es motivo para no hacerlo.
      }
      return nuevo;
    });
  }

  // El mapa llena el espacio entre el header y la bottom nav.
  useEffect(() => {
    function medir() {
      if (!contRef.current) return;
      const alto = (el: Element | null, siFalta: number) =>
        el ? el.getBoundingClientRect().height : siFalta;
      // Header y nav están pegados arriba y abajo, así que su alto es el
      // descuento correcto sin importar el scroll. Antes se usaba el `top` del
      // contenedor, que cambia al desplazarse y daba una medida corrida.
      const descuento =
        alto(document.querySelector('header'), 64) + alto(document.querySelector('nav'), 64);
      // visualViewport es lo que de verdad se ve en el celular: innerHeight no
      // descuenta las barras del navegador cuando están a la vista.
      const visible = window.visualViewport?.height ?? window.innerHeight;
      // El piso era 420, y en una pantalla baja eso hacía que el mapa se pasara
      // de largo: la barra de abajo lo tapaba y la página ganaba scroll. Vale
      // más un mapa chico que uno cortado.
      setAltura(Math.max(ALTO_MINIMO_MAPA, visible - descuento));
    }
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('orientationchange', medir);
    // En iOS, mostrar u ocultar la barra de direcciones cambia el alto visible
    // sin disparar `resize` de window.
    window.visualViewport?.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('orientationchange', medir);
      window.visualViewport?.removeEventListener('resize', medir);
    };
  }, []);

  const estadoPorLote = useMemo(() => {
    const m = new Map<string, EstadoLote>();
    for (const le of snapshot.lotes_estado ?? []) m.set(le.lote_id, le.estado);
    return m;
  }, [snapshot.lotes_estado]);

  const kgPorLote = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of snapshot.cosecha_mes_por_lote ?? []) m.set(c.lote_id, c.kg);
    return m;
  }, [snapshot.cosecha_mes_por_lote]);

  const prediccionPorLote = useMemo(() => {
    const m = new Map<string, NonNullable<SnapshotJefe['prediccion_por_lote']>[number]>();
    for (const p of snapshot.prediccion_por_lote ?? []) m.set(p.lote_id, p);
    return m;
  }, [snapshot.prediccion_por_lote]);

  const carenciaPorLote = useMemo(() => {
    const m = new Map<string, NonNullable<SnapshotJefe['carencias_por_lote']>[number]>();
    for (const c of snapshot.carencias_por_lote ?? []) m.set(c.lote_id, c);
    return m;
  }, [snapshot.carencias_por_lote]);

  const equipoPorLote = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of snapshot.equipo_hoy ?? []) {
      if (!a.lote_id) continue;
      const lista = m.get(a.lote_id) ?? [];
      lista.push(`${a.persona_nombre.split(' ')[0]} (${a.tarea_nombre.toLowerCase()})`);
      m.set(a.lote_id, lista);
    }
    return m;
  }, [snapshot.equipo_hoy]);

  const lotesMapa: LoteMapa3D[] = useMemo(() => {
    const maxKg = Math.max(0, ...Array.from(kgPorLote.values()));
    const conPoligono = geo.lotesParaMapa.filter(
      (l): l is typeof l & { geojson: NonNullable<typeof l.geojson> } => l.geojson !== null
    );
    // El color se reparte sobre todos los lotes de la finca, no solo sobre los
    // que tienen polígono: así un lote que todavía no fue delimitado no le
    // cambia el color a los demás el día que se delimite.
    const colores = asignarColoresLotes(geo.lotesParaMapa.map((l) => l.id));
    return conPoligono.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      estado: estadoPorLote.get(l.id) ?? 'aldia',
      color: colores.get(l.id) ?? '#3b6e8f',
      kgMes: kgPorLote.get(l.id) ?? 0,
      colorCosecha: rampaCosecha(kgPorLote.get(l.id) ?? 0, maxKg),
      trabajandoHoy: (equipoPorLote.get(l.id) ?? []).length,
      geojson: l.geojson,
    }));
  }, [geo.lotesParaMapa, estadoPorLote, kgPorLote, equipoPorLote]);

  async function alternarNdvi() {
    if (ndvi) {
      if (ndvi.url.startsWith('blob:')) URL.revokeObjectURL(ndvi.url);
      setNdvi(null);
      return;
    }
    try {
      const res = await fetch('/api/jefe/ndvi?info=1');
      const json = await res.json();
      if (!json.ok || !json.data.disponible) {
        setAvisoNdvi(json.data?.razon ?? 'NDVI no disponible');
        setTimeout(() => setAvisoNdvi(null), 6000);
        return;
      }
      // La imagen se descarga acá (no dentro del mapa) para poder mostrar
      // progreso y errores: la primera generación tarda varios segundos.
      setAvisoNdvi('Generando imagen satelital…');
      const imagen = await fetch('/api/jefe/ndvi');
      if (!imagen.ok) {
        const j = await imagen.json().catch(() => null);
        setAvisoNdvi(j?.error ?? 'No se pudo generar la imagen satelital');
        setTimeout(() => setAvisoNdvi(null), 8000);
        return;
      }
      const blob = await imagen.blob();
      setAvisoNdvi(null);
      setNdvi({ url: URL.createObjectURL(blob), bbox: json.data.bbox });
    } catch {
      setAvisoNdvi('Sin señal para cargar el NDVI');
      setTimeout(() => setAvisoNdvi(null), 6000);
    }
  }

  function iniciarVuelo() {
    if (lotesMapa.length === 0) return;
    setLoteId(null);
    setPanelAbierto(false);
    const ruta = ordenarPorCercania(
      lotesMapa.map((l) => ({ id: l.id, centro: centroVisualDePoligono(l.geojson) }))
    );
    setVuelo({ ruta, indice: 0, pausado: false });
  }

  // Cada parada: volar (2.6 s) + contemplar (2.6 s) y pasar a la siguiente.
  useEffect(() => {
    if (!vuelo || vuelo.pausado) return;
    const lote = lotesMapa.find((l) => l.id === vuelo.ruta[vuelo.indice]);
    if (!lote) {
      setVuelo(null);
      return;
    }
    mapaRef.current?.volarA({
      center: centroVisualDePoligono(lote.geojson),
      zoom: 15.3,
      pitch: 58,
      bearing: -15 + vuelo.indice * 30,
      duration: 2600,
    });
    const timer = setTimeout(() => {
      setVuelo((v) =>
        v === null || v.indice >= v.ruta.length - 1 ? null : { ...v, indice: v.indice + 1 }
      );
    }, 5200);
    return () => clearTimeout(timer);
  }, [vuelo, lotesMapa]);

  const loteEnVuelo = vuelo
    ? lotesMapa.find((l) => l.id === vuelo.ruta[vuelo.indice]) ?? null
    : null;

  // Al entrar al modo clima: traer el pronóstico una sola vez por sesión.
  useEffect(() => {
    if (modo !== 'clima' || clima !== null) return;
    let cancelado = false;
    fetch('/api/jefe/clima')
      .then((r) => r.json())
      .then((json) => {
        if (cancelado) return;
        setClima(json.ok ? json.data : 'error');
      })
      .catch(() => {
        if (!cancelado) setClima('error');
      });
    return () => {
      cancelado = true;
    };
  }, [modo, clima]);

  const loteSel = loteId ? geo.lotesParaMapa.find((l) => l.id === loteId) ?? null : null;
  const alertasDelLote = useMemo(() => {
    if (!loteId) return [];
    return [...snapshot.vencidas, ...snapshot.proximas].filter((a) => a.lote_id === loteId);
  }, [loteId, snapshot.vencidas, snapshot.proximas]);

  const fechaHoy = useMemo(() => {
    const texto = FORMATEADOR_FECHA.format(new Date());
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, []);

  return (
    <div
      ref={contRef}
      className="relative -mx-4 -my-6 overflow-hidden"
      style={{ height: altura ?? '70svh' }}
    >
      {conWebGL === false ? (
        // `isolate` es lo que mantiene a Leaflet en su lugar. Sus paneles usan
        // z-index 400 y .leaflet-container no crea contexto de apilamiento
        // propio, así que esos 400 competían de igual a igual contra el z-10
        // del saludo y del dock de KPIs — y ganaban. En el iPhone, que cae a
        // este mapa cuando iOS se queda sin memoria para WebGL, el efecto era
        // que la pantalla aparecía sin saludo y sin indicadores: no faltaban,
        // estaban debajo del mapa.
        <>
          {/* Los controles de Leaflet se anclan al borde de abajo a la derecha,
              que es donde vive la barra de indicadores: sin el empujón quedan
              tapados, igual que pasaba con los de MapLibre en el mapa 3D. */}
          <div className="isolate h-full w-full p-3 [&_.leaflet-bottom.leaflet-right]:mb-[4.5rem]">
            <MapaFincaFallback
              lotesPoligonos={geo.lotesParaMapa}
              apiariosPuntos={geo.apiariosParaMapa}
              instalacionesPuntos={geo.instParaMapa}
              bordeFinca={geo.bordeFinca}
              altura="100%"
              zoomAbajo
            />
          </div>
          {/* Fuera del contenedor aislado a propósito: adentro quedaría por
              debajo de los paneles de Leaflet, que es el mismo problema que
              tenían el saludo y el dock. Caer al 2D no debería ser un camino de
              ida: si fue un tropiezo pasajero —una baldosa que no llegó,
              memoria que se liberó— hay que poder volver sin cerrar la app. */}
          <button
            type="button"
            onClick={() => setConWebGL(true)}
            className="pointer-events-auto absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/60 bg-zelanda-beige-50/90 px-4 py-2 text-xs font-medium text-zelanda-verde-800 shadow-card backdrop-blur-md"
          >
            Volver al mapa 3D
          </button>
        </>
      ) : conWebGL === true ? (
        <Mapa3D
          ref={mapaRef}
          lotes={lotesMapa}
          bordeFinca={geo.bordeFinca}
          apiarios={geo.apiariosParaMapa}
          instalaciones={geo.instParaMapa}
          modo={modo}
          ndvi={ndvi}
          lotesVisibles={lotesVisibles}
          onSeleccionLote={(id) => {
            setVuelo(null);
            setLoteId(id);
          }}
          onError={() => setConWebGL(false)}
        />
      ) : null}

      {/* Saludo + chips */}
      <div className="pointer-events-none absolute left-3 right-14 top-3 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto self-start rounded-2xl border border-white/60 bg-zelanda-beige-50/85 px-3.5 py-2 shadow-card backdrop-blur-md">
          <Eyebrow>Centro de control</Eyebrow>
          <p className="m-0 font-serif text-[17px] leading-tight text-zelanda-verde-900">
            {saludo}, {nombrePila}
          </p>
          <p className="m-0 text-[10.5px] text-zelanda-verde-700">{fechaHoy}</p>
        </div>
        <div className="pointer-events-auto">
          <ChipsModos modo={modo} onCambio={setModo} />
        </div>
      </div>

      {/* Acciones del mapa: botones chicos arriba a la derecha */}
      {conWebGL === true ? (
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
          {!vuelo && lotesMapa.length > 0 ? (
            <button
              type="button"
              onClick={iniciarVuelo}
              title="Vuelo de dron"
              aria-label="Vuelo de dron"
              className={BTN_MAPA}
            >
              <Plane className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={alternarNdvi}
            title="Salud del cultivo"
            aria-label="Salud del cultivo"
            className={ndvi ? BTN_MAPA_ACTIVO : BTN_MAPA}
          >
            <Satellite className="h-4 w-4" aria-hidden />
          </button>
          {/* El borde de la finca no se apaga nunca: apagar los lotes es para
              mirar el terreno, no para perder de vista hasta dónde llega. */}
          <button
            type="button"
            onClick={alternarLotes}
            title={lotesVisibles ? 'Ocultar lotes' : 'Mostrar lotes'}
            aria-label={lotesVisibles ? 'Ocultar lotes' : 'Mostrar lotes'}
            aria-pressed={lotesVisibles}
            className={lotesVisibles ? BTN_MAPA_ACTIVO : BTN_MAPA}
          >
            <Layers className="h-4 w-4" aria-hidden />
          </button>
          {ndvi ? (
            <div className="pointer-events-auto rounded-xl border border-white/60 bg-zelanda-beige-50/90 px-2.5 py-2 shadow-suave backdrop-blur-md">
              <p className="m-0 mb-1 text-[9px] font-semibold uppercase tracking-wide text-zelanda-verde-800">
                Vigor del cultivo
              </p>
              {LEYENDA_NDVI.map((n) => (
                <p
                  key={n.etiqueta}
                  className="m-0 flex items-center gap-1.5 text-[10px] leading-4 text-zelanda-verde-800"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: n.color }}
                  />
                  {n.etiqueta}
                </p>
              ))}
            </div>
          ) : null}
          {avisoNdvi ? (
            <p className="pointer-events-auto m-0 max-w-[230px] rounded-xl bg-zelanda-verde-900/85 px-3 py-1.5 text-right text-[11.5px] text-zelanda-beige-50 backdrop-blur-md">
              {avisoNdvi}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Vuelo de dron, panel de lote o dock */}
      <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2">
        {conWebGL === true ? (
          <button
            type="button"
            onClick={() => mapaRef.current?.encuadrarFinca()}
            title="Ver toda la finca"
            aria-label="Ver toda la finca"
            className={`${BTN_MAPA} self-start`}
          >
            <Scan className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        {vuelo && loteEnVuelo ? (
          <VueloDron
            lote={loteEnVuelo}
            numero={vuelo.indice + 1}
            total={vuelo.ruta.length}
            pausado={vuelo.pausado}
            onPausar={() => setVuelo((v) => (v ? { ...v, pausado: !v.pausado } : v))}
            onSalir={() => setVuelo(null)}
          />
        ) : modo === 'clima' ? (
          <PanelClima clima={clima} />
        ) : loteSel ? (
          <PanelLote
            lote={loteSel}
            estado={estadoPorLote.get(loteSel.id) ?? 'aldia'}
            kgMes={kgPorLote.get(loteSel.id) ?? 0}
            alertas={alertasDelLote}
            trabajando={equipoPorLote.get(loteSel.id) ?? []}
            prediccion={prediccionPorLote.get(loteSel.id) ?? null}
            carencia={carenciaPorLote.get(loteSel.id) ?? null}
            onCerrar={() => setLoteId(null)}
          />
        ) : (
          <DockKPIs contadores={snapshot.contadores} />
        )}
      </div>

      {panelAbierto ? (
        <PanelCentral
          snapshot={snapshot}
          tsCache={tsCache}
          onCerrar={() => setPanelAbierto(false)}
        />
      ) : null}
    </div>
  );
}
