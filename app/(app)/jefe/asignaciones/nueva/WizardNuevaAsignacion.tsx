'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  MapPin,
  Check,
  Hexagon,
  Leaf,
  Bug,
  Apple,
  Scissors,
  Droplets,
  Sprout,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { fmtCarenciaHasta } from '@/lib/carencia';
import { Stepper } from '@/components/ui/Stepper';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Segmented';
import { AvatarIniciales } from '@/components/shared/AvatarIniciales';
import { crearAsignacion, type EstadoAsignacion } from '../acciones';

type EstadoLote = 'vencida' | 'proxima' | 'aldia';

type LoteOpcion = {
  id: string;
  nombre: string;
  total_arboles: number;
  hectareas: number | null;
  estado: EstadoLote;
  proxima_tarea: string;
  tipo_sugerido_id: string | null;
};

type ApiarioOpcion = {
  id: string;
  nombre: string;
  total_colmenas: number;
};

type TipoOpcion = {
  id: string;
  nombre: string;
  area: 'CULTIVO' | 'APICULTURA';
  freq: number;
};

type PersonaOpcion = {
  id: string;
  nombre_completo: string;
  vinculo: string;
  rol_finca: string | null;
  carga: number;
  ultimos: string[];
};

function iconoTarea(nombre: string, area: string): LucideIcon {
  const n = nombre.toLowerCase();
  if (area === 'APICULTURA') {
    if (n.includes('miel')) return Sprout;
    return Hexagon;
  }
  if (n.includes('rieg')) return Droplets;
  if (n.includes('poda')) return Scissors;
  if (n.includes('fert')) return Sprout;
  if (n.includes('plag')) return Bug;
  if (n.includes('cosech')) return Apple;
  return Leaf;
}

const ESTADO_INICIAL: EstadoAsignacion = { error: null };

export function WizardNuevaAsignacion({
  lotes,
  apiarios,
  tipos,
  personas,
  carencias,
  preselect,
}: {
  lotes: LoteOpcion[];
  apiarios: ApiarioOpcion[];
  tipos: TipoOpcion[];
  personas: PersonaOpcion[];
  carencias: { lote_id: string; insumo: string; hasta: string }[];
  preselect: {
    lote_id: string | null;
    apiario_id: string | null;
    tipo_tarea_id: string | null;
  };
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [destino, setDestino] = useState<'lote' | 'apiario'>(
    preselect.apiario_id ? 'apiario' : 'lote'
  );
  const [paso, setPaso] = useState(1);
  const [loteId, setLoteId] = useState<string | null>(preselect.lote_id);
  const [apiarioId, setApiarioId] = useState<string | null>(preselect.apiario_id);
  const [tipoId, setTipoId] = useState<string | null>(preselect.tipo_tarea_id);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = useState<string>(hoy);

  const loteSel = loteId ? lotes.find((l) => l.id === loteId) ?? null : null;
  const apiarioSel = apiarioId ? apiarios.find((a) => a.id === apiarioId) ?? null : null;
  const tipoSel = tipoId ? tipos.find((t) => t.id === tipoId) ?? null : null;
  const personaSel = personaId ? personas.find((p) => p.id === personaId) ?? null : null;

  const destinoSeleccionado = destino === 'lote' ? loteSel : apiarioSel;

  // Advertencia de carencia: solo tareas de cosecha en lotes (heurística por
  // nombre: los tipos de tarea son configurables). Apiarios no tienen lote.
  const advertenciaCarencia =
    destino === 'lote' && loteId && tipoSel && /cosech/i.test(tipoSel.nombre)
      ? carencias.find((c) => c.lote_id === loteId) ?? null
      : null;

  function avanzar() {
    setError(null);
    if (paso === 1) {
      if (destino === 'lote' && !loteId) {
        setError('Selecciona un lote.');
        return;
      }
      if (destino === 'apiario' && !apiarioId) {
        setError('Selecciona un apiario.');
        return;
      }
      // si destino cambia de área, limpiar tipo
      if (tipoSel) {
        const areaEsperada = destino === 'lote' ? 'CULTIVO' : 'APICULTURA';
        if (tipoSel.area !== areaEsperada) setTipoId(null);
      }
      setPaso(2);
      return;
    }
    if (paso === 2) {
      if (!tipoId) {
        setError('Selecciona un tipo de tarea.');
        return;
      }
      setPaso(3);
      return;
    }
    if (paso === 3) {
      if (!personaId) {
        setError('Selecciona quién la hace.');
        return;
      }
      setPaso(4);
      return;
    }
  }

  function retroceder() {
    setError(null);
    if (paso === 1) {
      router.push('/jefe/asignaciones');
      return;
    }
    setPaso(paso - 1);
  }

  function enviar() {
    setError(null);
    if (!tipoId || !personaId) return;
    if (destino === 'lote' && !loteId) return;
    if (destino === 'apiario' && !apiarioId) return;

    const fd = new FormData();
    fd.set('destino', destino);
    if (destino === 'lote' && loteId) fd.set('lote_id', loteId);
    if (destino === 'apiario' && apiarioId) fd.set('apiario_id', apiarioId);
    fd.set('tipo_tarea_id', tipoId);
    fd.set('persona_id', personaId);
    fd.set('fecha_inicio', fecha);

    startTransition(async () => {
      const r = await crearAsignacion(ESTADO_INICIAL, fd);
      if (r.error) setError(r.error);
    });
  }

  const tituloPorPaso = [
    '',
    '¿En qué lote?',
    '¿Qué tarea?',
    '¿Quién la hace?',
    'Confirmar asignación',
  ];

  return (
    <div className="-mx-4 -mt-4 flex min-h-svh flex-col">
      <div className="bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 px-4 pb-3 pt-3 text-zelanda-beige-50">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={retroceder}
            aria-label={paso === 1 ? 'Cancelar' : 'Atrás'}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-zelanda-beige-50 hover:bg-white/15"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
              Nueva asignación · paso {paso} de 4
            </p>
            <h1 className="m-0 mt-0.5 font-serif text-[20px] font-medium leading-tight">
              {tituloPorPaso[paso]}
            </h1>
          </div>
        </div>
        <Stepper pasos={4} actual={paso} className="mt-3" />
      </div>

      <div className="flex-1 px-4 pb-[88px] pt-4">
        {paso === 1 ? (
          <Paso1
            destino={destino}
            setDestino={(d) => {
              setDestino(d);
              setError(null);
            }}
            lotes={lotes}
            apiarios={apiarios}
            loteId={loteId}
            setLoteId={(id) => {
              setLoteId(id);
              const l = lotes.find((x) => x.id === id);
              if (l?.tipo_sugerido_id && !tipoId) {
                setTipoId(l.tipo_sugerido_id);
              }
            }}
            apiarioId={apiarioId}
            setApiarioId={setApiarioId}
          />
        ) : null}
        {paso === 2 ? (
          <Paso2
            lote={loteSel}
            apiario={apiarioSel}
            destino={destino}
            tipos={tipos.filter((t) =>
              destino === 'lote' ? t.area === 'CULTIVO' : t.area === 'APICULTURA'
            )}
            tipoId={tipoId}
            setTipoId={setTipoId}
            fecha={fecha}
            setFecha={setFecha}
          />
        ) : null}
        {paso === 3 ? (
          <Paso3
            tipo={tipoSel}
            personas={personas}
            personaId={personaId}
            setPersonaId={setPersonaId}
          />
        ) : null}
        {paso === 4 ? (
          <Paso4
            destino={destino}
            destinoSeleccionado={destinoSeleccionado}
            tipo={tipoSel}
            persona={personaSel}
            fecha={fecha}
          />
        ) : null}

        {paso === 4 && advertenciaCarencia ? (
          <p className="mt-4 flex items-start gap-2 rounded-[10px] border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-sm text-zelanda-ocre-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Este lote está en carencia hasta el {fmtCarenciaHasta(advertenciaCarencia.hasta)} por{' '}
              {advertenciaCarencia.insumo} — la fruta podría no ser apta si se cosecha antes.
            </span>
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-[10px] border border-estado-vencida/30 bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div
        className="fixed inset-x-0 bottom-16 z-10 border-t border-zelanda-beige-300 bg-white/95 px-4 py-2.5 backdrop-blur"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-screen-md items-center gap-2">
          <button
            type="button"
            onClick={retroceder}
            disabled={pendiente}
            className="flex min-h-touch min-w-[80px] items-center justify-center rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 font-semibold text-zelanda-verde-800 hover:bg-zelanda-beige-200 disabled:opacity-60"
          >
            {paso === 1 ? 'Cancelar' : 'Atrás'}
          </button>
          {paso < 4 ? (
            <button
              type="button"
              onClick={avanzar}
              className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={enviar}
              disabled={pendiente}
              className="flex min-h-touch flex-1 items-center justify-center gap-2 rounded-xl bg-zelanda-verde-700 px-4 font-semibold text-zelanda-beige-50 transition hover:bg-zelanda-verde-800 disabled:opacity-60 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
            >
              <Check className="h-[18px] w-[18px]" />
              {pendiente ? 'Creando…' : 'Crear asignación'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Paso1({
  destino,
  setDestino,
  lotes,
  apiarios,
  loteId,
  setLoteId,
  apiarioId,
  setApiarioId,
}: {
  destino: 'lote' | 'apiario';
  setDestino: (d: 'lote' | 'apiario') => void;
  lotes: LoteOpcion[];
  apiarios: ApiarioOpcion[];
  loteId: string | null;
  setLoteId: (id: string) => void;
  apiarioId: string | null;
  setApiarioId: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const lotesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filt = lotes.filter((l) => !q || l.nombre.toLowerCase().includes(q));
    const orden: Record<EstadoLote, number> = {
      vencida: 0,
      proxima: 1,
      aldia: 2,
    };
    return [...filt].sort((a, b) => orden[a.estado] - orden[b.estado]);
  }, [busqueda, lotes]);

  const apiariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return apiarios.filter((a) => !q || a.nombre.toLowerCase().includes(q));
  }, [busqueda, apiarios]);

  const sugeridos = lotesFiltrados.filter((l) => l.estado !== 'aldia');

  return (
    <div>
      <p className="m-0 mb-3 text-[12.5px] text-zelanda-verde-700">Elegí dónde se hará la tarea.</p>

      <Segmented
        opciones={[
          { id: 'lote', etiqueta: 'Lote' },
          { id: 'apiario', etiqueta: 'Apiario' },
        ]}
        valor={destino}
        onCambio={setDestino}
      />

      <div className="relative mt-3">
        <input
          className="h-11 w-full rounded-[10px] border border-zelanda-beige-300 bg-white pl-9 pr-3 text-[15px] outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
          placeholder={destino === 'lote' ? 'Buscar lote…' : 'Buscar apiario…'}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zelanda-verde-400" />
      </div>

      {destino === 'lote' ? (
        <>
          {sugeridos.length > 0 && !busqueda ? (
            <>
              <p className="mb-1.5 mt-4 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
                Sugeridos · necesitan atención
              </p>
              <div className="flex flex-col gap-2">
                {sugeridos.slice(0, 3).map((l) => (
                  <LoteRow
                    key={l.id}
                    lote={l}
                    seleccionado={l.id === loteId}
                    onClick={() => setLoteId(l.id)}
                    destacado
                  />
                ))}
              </div>
            </>
          ) : null}

          <p className="mb-1.5 mt-4 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Todos los lotes{' '}
            <span className="text-[11px] normal-case tracking-normal text-zelanda-verde-700/80">
              ({lotesFiltrados.length})
            </span>
          </p>
          <div className="flex flex-col gap-1.5">
            {lotesFiltrados.map((l) => (
              <LoteRow
                key={l.id}
                lote={l}
                seleccionado={l.id === loteId}
                onClick={() => setLoteId(l.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mb-1.5 mt-4 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
            Apiarios ({apiariosFiltrados.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {apiariosFiltrados.map((a) => (
              <ApiarioRow
                key={a.id}
                apiario={a}
                seleccionado={a.id === apiarioId}
                onClick={() => setApiarioId(a.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LoteRow({
  lote,
  seleccionado,
  onClick,
  destacado,
}: {
  lote: LoteOpcion;
  seleccionado: boolean;
  onClick: () => void;
  destacado?: boolean;
}) {
  const inicial = lote.nombre.charAt(0).toUpperCase();
  const colorWrap =
    lote.estado === 'vencida'
      ? 'bg-[#fcefec] text-[#7b2a23]'
      : lote.estado === 'proxima'
      ? 'bg-[#fbf3df] text-zelanda-ocre-700'
      : 'bg-zelanda-verde-50 text-zelanda-verde-700';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[56px] w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left shadow-suave transition ${
        seleccionado
          ? 'border-2 border-zelanda-verde-700 bg-zelanda-verde-50'
          : `border ${
              destacado ? 'border-zelanda-ocre-200' : 'border-zelanda-beige-200'
            } bg-white hover:border-zelanda-verde-300`
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] font-serif text-base font-semibold ${colorWrap}`}
      >
        {inicial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">{lote.nombre}</p>
        <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
          {lote.total_arboles.toLocaleString('es-CO')} árboles · {lote.proxima_tarea}
        </p>
      </div>
      <Badge estado={lote.estado} />
    </button>
  );
}

function ApiarioRow({
  apiario,
  seleccionado,
  onClick,
}: {
  apiario: ApiarioOpcion;
  seleccionado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[56px] w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left shadow-suave transition ${
        seleccionado
          ? 'border-2 border-zelanda-verde-700 bg-zelanda-verde-50'
          : 'border border-zelanda-beige-200 bg-white hover:border-zelanda-verde-300'
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-zelanda-ocre-50 text-zelanda-ocre-700">
        <Hexagon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-serif text-[15px] text-zelanda-verde-900">{apiario.nombre}</p>
        <p className="m-0 mt-0.5 text-[11.5px] text-zelanda-verde-700">
          {apiario.total_colmenas} colmenas
        </p>
      </div>
    </button>
  );
}

function Paso2({
  lote,
  apiario,
  destino,
  tipos,
  tipoId,
  setTipoId,
  fecha,
  setFecha,
}: {
  lote: LoteOpcion | null;
  apiario: ApiarioOpcion | null;
  destino: 'lote' | 'apiario';
  tipos: TipoOpcion[];
  tipoId: string | null;
  setTipoId: (id: string) => void;
  fecha: string;
  setFecha: (f: string) => void;
}) {
  const sugerido = lote?.estado === 'aldia' ? null : lote?.tipo_sugerido_id ?? null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-zelanda-verde-200 bg-zelanda-verde-50 px-3 py-2">
        <MapPin className="h-4 w-4 text-zelanda-verde-700" />
        <span className="text-[12.5px] text-zelanda-verde-800">
          {destino === 'lote' ? 'Lote · ' : 'Apiario · '}
          <strong className="font-serif">
            {destino === 'lote' ? lote?.nombre : apiario?.nombre}
          </strong>
          {destino === 'lote' && lote ? ` · ${lote.proxima_tarea}` : ''}
        </span>
      </div>

      <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700">
        {destino === 'lote' ? 'Cultivo' : 'Apicultura'}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {tipos.map((t) => (
          <TareaCard
            key={t.id}
            tarea={t}
            seleccionada={t.id === tipoId}
            destacada={t.id === sugerido}
            onClick={() => setTipoId(t.id)}
          />
        ))}
      </div>

      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-zelanda-verde-700">
        Fecha objetivo
      </label>
      <div className="relative">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="h-11 w-full rounded-[10px] border border-zelanda-beige-300 bg-white pl-9 pr-3 text-[15px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
        />
        <Calendar className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zelanda-verde-400" />
      </div>
      <p className="m-0 mt-1.5 text-[11.5px] text-zelanda-verde-700">
        Esta fecha actualiza la “próxima” del {destino === 'lote' ? 'lote' : 'apiario'}.
      </p>
    </div>
  );
}

function TareaCard({
  tarea,
  seleccionada,
  destacada,
  onClick,
}: {
  tarea: TipoOpcion;
  seleccionada: boolean;
  destacada?: boolean;
  onClick: () => void;
}) {
  const Icono = iconoTarea(tarea.nombre, tarea.area);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[88px] flex-col gap-1.5 rounded-xl px-3 py-3 text-left ${
        seleccionada
          ? 'border-2 border-zelanda-verde-700 bg-zelanda-verde-50'
          : `border ${
              destacada ? 'border-zelanda-ocre-300' : 'border-zelanda-beige-200'
            } bg-white hover:border-zelanda-verde-300`
      }`}
    >
      {destacada ? (
        <span className="absolute -top-2 right-2 rounded-full bg-zelanda-ocre-400 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-white">
          Sugerida
        </span>
      ) : null}
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${
          seleccionada
            ? 'bg-zelanda-verde-700 text-zelanda-beige-50'
            : 'bg-zelanda-beige-100 text-zelanda-verde-700'
        }`}
      >
        <Icono className="h-4 w-4" />
      </span>
      <span className="font-serif text-[14px] leading-tight text-zelanda-verde-900">
        {tarea.nombre}
      </span>
      <span className="text-[11px] text-zelanda-verde-700">cada {tarea.freq} d</span>
    </button>
  );
}

function Paso3({
  tipo,
  personas,
  personaId,
  setPersonaId,
}: {
  tipo: TipoOpcion | null;
  personas: PersonaOpcion[];
  personaId: string | null;
  setPersonaId: (id: string) => void;
}) {
  const [filtro, setFiltro] = useState<'disponibles' | 'todos'>('disponibles');

  const lista = useMemo(() => {
    let arr = [...personas];
    if (filtro === 'disponibles') arr = arr.filter((p) => p.carga < 2);
    return arr.sort((a, b) => a.carga - b.carga);
  }, [filtro, personas]);

  const disponibles = personas.filter((p) => p.carga < 2).length;

  return (
    <div>
      <p className="m-0 mb-3 text-[12.5px] text-zelanda-verde-700">
        Asigná a una persona.{' '}
        {tipo?.area === 'APICULTURA' ? 'Cualquier persona disponible puede ir al apiario.' : ''}
      </p>

      <Segmented
        opciones={[
          { id: 'disponibles', etiqueta: `Disponibles (${disponibles})` },
          { id: 'todos', etiqueta: `Todos (${personas.length})` },
        ]}
        valor={filtro}
        onCambio={setFiltro}
      />

      <div className="mt-3 flex flex-col gap-1.5">
        {lista.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
            No hay personas {filtro === 'disponibles' ? 'disponibles' : 'registradas'}.
          </p>
        ) : (
          lista.map((p) => (
            <PersonaRow
              key={p.id}
              persona={p}
              seleccionada={p.id === personaId}
              onClick={() => setPersonaId(p.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PersonaRow({
  persona,
  seleccionada,
  onClick,
}: {
  persona: PersonaOpcion;
  seleccionada: boolean;
  onClick: () => void;
}) {
  const cargaLabel =
    persona.carga === 0 ? 'Libre' : persona.carga === 1 ? '1 tarea' : `${persona.carga} tareas`;
  const cargaColor =
    persona.carga === 0
      ? 'text-estado-aldia'
      : persona.carga <= 1
      ? 'text-zelanda-verde-700'
      : persona.carga === 2
      ? 'text-zelanda-ocre-700'
      : 'text-estado-vencida';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[60px] w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
        seleccionada
          ? 'border-2 border-zelanda-verde-700 bg-zelanda-verde-50'
          : 'border border-zelanda-beige-200 bg-white hover:border-zelanda-verde-300'
      }`}
    >
      <span
        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] ${
          seleccionada
            ? 'bg-zelanda-verde-700 text-white'
            : 'border-2 border-zelanda-beige-300 bg-white'
        }`}
      >
        {seleccionada ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
      <AvatarIniciales id={persona.id} nombre={persona.nombre_completo} tamano="sm" />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-serif text-[14.5px] text-zelanda-verde-900">
          {persona.nombre_completo}
        </p>
        <p className="m-0 mt-0.5 truncate text-[11.5px] text-zelanda-verde-700">
          {persona.vinculo}
          {persona.rol_finca ? ` · ${persona.rol_finca}` : ''}
          {persona.ultimos[0] ? ` · último: ${persona.ultimos[0]}` : ''}
        </p>
      </div>
      <span className={`whitespace-nowrap text-[11px] font-semibold ${cargaColor}`}>
        {cargaLabel}
      </span>
    </button>
  );
}

function Paso4({
  destino,
  destinoSeleccionado,
  tipo,
  persona,
  fecha,
}: {
  destino: 'lote' | 'apiario';
  destinoSeleccionado: LoteOpcion | ApiarioOpcion | null;
  tipo: TipoOpcion | null;
  persona: PersonaOpcion | null;
  fecha: string;
}) {
  const fechaLegible = (() => {
    try {
      const d = new Date(`${fecha}T00:00:00`);
      return d.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return fecha;
    }
  })();

  if (!destinoSeleccionado || !tipo || !persona) {
    return (
      <p className="rounded-xl border border-dashed border-zelanda-beige-300 bg-white px-6 py-8 text-center text-sm text-zelanda-verde-700">
        Faltan datos para confirmar.
      </p>
    );
  }

  const esLote = destino === 'lote';
  const cantidadInfo = esLote
    ? `${(destinoSeleccionado as LoteOpcion).total_arboles.toLocaleString('es-CO')} árboles`
    : `${(destinoSeleccionado as ApiarioOpcion).total_colmenas} colmenas`;
  const hectareasInfo = esLote ? (destinoSeleccionado as LoteOpcion).hectareas : null;

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-zelanda-verde-300 bg-white shadow-card">
        <div className="bg-gradient-to-br from-zelanda-verde-700 to-zelanda-verde-800 px-3.5 py-3 text-zelanda-beige-50">
          <p className="m-0 text-[10.5px] uppercase tracking-[0.16em] text-zelanda-beige-100/72">
            Asignación
          </p>
          <h2 className="m-0 mt-1 font-serif text-[22px] font-medium leading-tight">
            {tipo.nombre} · {destinoSeleccionado.nombre}
          </h2>
          <p className="m-0 mt-1 text-[12.5px] capitalize text-zelanda-beige-100/85">
            {fechaLegible}
          </p>
        </div>

        <div className="px-3.5 py-3">
          <RevisarFila label={esLote ? 'Lote' : 'Apiario'}>
            <span className="font-serif text-[14px] text-zelanda-verde-900">
              {destinoSeleccionado.nombre}
            </span>
            <span className="ml-2 text-[11.5px] text-zelanda-verde-700">
              {cantidadInfo}
              {hectareasInfo !== null ? ` · ${hectareasInfo.toFixed(1)} ha` : ''}
            </span>
          </RevisarFila>
          <RevisarFila label="Tarea">
            <span className="font-serif text-[14px] text-zelanda-verde-900">{tipo.nombre}</span>
            <span className="ml-2 text-[11.5px] text-zelanda-verde-700">
              cada {tipo.freq} d · {tipo.area.toLowerCase()}
            </span>
          </RevisarFila>
          <RevisarFila label="Trabajador">
            <span className="inline-flex items-center gap-2">
              <AvatarIniciales id={persona.id} nombre={persona.nombre_completo} tamano="sm" />
              <span className="text-[13px] text-zelanda-verde-900">{persona.nombre_completo}</span>
            </span>
          </RevisarFila>
          <RevisarFila label="Fecha objetivo">
            <span className="text-[13px] capitalize text-zelanda-verde-900">{fechaLegible}</span>
          </RevisarFila>
        </div>
      </div>

      <p className="mt-4 text-[11.5px] text-zelanda-verde-700">
        Al crear, la persona recibirá una notificación push si tiene notificaciones habilitadas.
      </p>
    </div>
  );
}

function RevisarFila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-zelanda-beige-200 py-2 last:border-b-0">
      <p className="m-0 w-[110px] shrink-0 text-[10.5px] uppercase tracking-[0.12em] text-zelanda-verde-700">
        {label}
      </p>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
