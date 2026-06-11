'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Plane } from 'lucide-react';
import Mapa3D, { type LoteMapa3D, type ManijaMapa3D, type ModoMapa } from './Mapa3D';
import { ChipsModos } from './ChipsModos';
import { DockKPIs } from './DockKPIs';
import { PanelLote } from './PanelLote';
import { PanelCentral } from './PanelCentral';
import { VueloDron } from './VueloDron';
import { useSnapshotJefe } from '@/hooks/useSnapshotJefe';
import { ordenarPorCercania } from '@/lib/ruta-dron';
import { centroideDePoligono, rampaCosecha, type EstadoLote } from '@/lib/mapa3d';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { SnapshotJefe } from '@/lib/offline/tipos';
import type { GeoFinca } from '@/lib/geo-finca';

// Fallback Leaflet: solo se descarga si el dispositivo no tiene WebGL.
const MapaFincaFallback = dynamic(() => import('@/components/mapa/MapaFinca'), {
  ssr: false,
});

function soportaWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const FORMATEADOR_FECHA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Bogota',
});

export function CentroControl({
  nombrePila,
  snapshotInicial,
  geo,
}: {
  nombrePila: string;
  snapshotInicial: SnapshotJefe;
  geo: GeoFinca;
}) {
  const { snapshot, tsCache } = useSnapshotJefe(snapshotInicial);
  const [modo, setModo] = useState<ModoMapa>('tareas');
  const [loteId, setLoteId] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [conWebGL, setConWebGL] = useState<boolean | null>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState<number | null>(null);
  const [vuelo, setVuelo] = useState<{
    ruta: string[];
    indice: number;
    pausado: boolean;
  } | null>(null);
  const mapaRef = useRef<ManijaMapa3D>(null);

  useEffect(() => {
    setConWebGL(soportaWebGL());
  }, []);

  // El mapa llena el espacio entre el header y la bottom nav.
  useEffect(() => {
    function medir() {
      const el = contRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const nav = document.querySelector('nav');
      const navAltura = nav ? nav.getBoundingClientRect().height : 64;
      setAltura(Math.max(420, window.innerHeight - top - navAltura));
    }
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
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
    return geo.lotesParaMapa
      .filter((l): l is typeof l & { geojson: NonNullable<typeof l.geojson> } => l.geojson !== null)
      .map((l) => ({
        id: l.id,
        nombre: l.nombre,
        estado: estadoPorLote.get(l.id) ?? 'aldia',
        kgMes: kgPorLote.get(l.id) ?? 0,
        colorCosecha: rampaCosecha(kgPorLote.get(l.id) ?? 0, maxKg),
        trabajandoHoy: (equipoPorLote.get(l.id) ?? []).length,
        geojson: l.geojson,
      }));
  }, [geo.lotesParaMapa, estadoPorLote, kgPorLote, equipoPorLote]);

  function iniciarVuelo() {
    if (lotesMapa.length === 0) return;
    setLoteId(null);
    setPanelAbierto(false);
    const ruta = ordenarPorCercania(
      lotesMapa.map((l) => ({ id: l.id, centro: centroideDePoligono(l.geojson) }))
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
      center: centroideDePoligono(lote.geojson),
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
        <div className="h-full w-full p-3">
          <MapaFincaFallback
            lotesPoligonos={geo.lotesParaMapa}
            apiariosPuntos={geo.apiariosParaMapa}
            instalacionesPuntos={geo.instParaMapa}
            bordeFinca={geo.bordeFinca}
            altura="100%"
          />
        </div>
      ) : conWebGL === true ? (
        <Mapa3D
          ref={mapaRef}
          lotes={lotesMapa}
          bordeFinca={geo.bordeFinca}
          apiarios={geo.apiariosParaMapa}
          modo={modo}
          onSeleccionLote={(id) => {
            setVuelo(null);
            setLoteId(id);
          }}
          onError={() => setConWebGL(false)}
        />
      ) : null}

      {/* Saludo + chips */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto self-start rounded-2xl border border-white/60 bg-zelanda-beige-50/85 px-3.5 py-2 shadow-card backdrop-blur-md">
          <Eyebrow>Centro de control</Eyebrow>
          <p className="m-0 font-serif text-[17px] leading-tight text-zelanda-verde-900">
            Buen día, {nombrePila}
          </p>
          <p className="m-0 text-[10.5px] text-zelanda-verde-700">{fechaHoy}</p>
        </div>
        <div className="pointer-events-auto">
          <ChipsModos modo={modo} onCambio={setModo} />
        </div>
        {conWebGL === true && !vuelo ? (
          <button
            type="button"
            onClick={iniciarVuelo}
            className="pointer-events-auto flex items-center gap-1.5 self-start rounded-full border border-white/60 bg-zelanda-beige-50/85 px-3.5 py-1.5 text-xs font-medium text-zelanda-verde-800 shadow-suave backdrop-blur-md"
          >
            <Plane className="h-3.5 w-3.5" aria-hidden />
            Vuelo de dron
          </button>
        ) : null}
      </div>

      {/* Vuelo de dron, panel de lote o dock */}
      <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-2">
        {vuelo && loteEnVuelo ? (
          <VueloDron
            lote={loteEnVuelo}
            numero={vuelo.indice + 1}
            total={vuelo.ruta.length}
            pausado={vuelo.pausado}
            onPausar={() => setVuelo((v) => (v ? { ...v, pausado: !v.pausado } : v))}
            onSalir={() => setVuelo(null)}
          />
        ) : loteSel ? (
          <PanelLote
            lote={loteSel}
            estado={estadoPorLote.get(loteSel.id) ?? 'aldia'}
            kgMes={kgPorLote.get(loteSel.id) ?? 0}
            alertas={alertasDelLote}
            trabajando={equipoPorLote.get(loteSel.id) ?? []}
            onCerrar={() => setLoteId(null)}
          />
        ) : (
          <DockKPIs contadores={snapshot.contadores} onAbrirPanel={() => setPanelAbierto(true)} />
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
