'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CloudOff, Check, ListPlus } from 'lucide-react';
import { enviarAvance } from '@/lib/offline/api-cliente';
import { parsearDecimal } from '@/lib/formatos';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { SubirFoto } from '@/components/shared/SubirFoto';
import type { EstadoApiario } from '@/lib/offline/tipos';

const inputBase =
  'mt-2 block min-h-[64px] w-full rounded-xl border-2 border-zelanda-beige-300 bg-white px-4 text-2xl text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400';

const labelBase = 'block text-base font-semibold text-zelanda-verde-800';

const botonGrande =
  'flex min-h-[68px] w-full items-center justify-center gap-3 rounded-2xl px-4 text-center text-lg font-semibold transition';

const botonPrimario = `${botonGrande} bg-zelanda-verde-700 text-zelanda-beige-50 hover:bg-zelanda-verde-800 disabled:cursor-not-allowed disabled:opacity-60 [box-shadow:0_3px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]`;

const botonSecundario = `${botonGrande} border-2 border-zelanda-beige-300 bg-white text-zelanda-verde-800 hover:border-zelanda-verde-300`;

type Asignacion = {
  id: string;
  tipoTarea: string;
  area: 'CULTIVO' | 'APICULTURA';
  esCosechaMiel: boolean;
  loteNombre: string | null;
  totalArboles: number | null;
  arbolesCompletados: number;
  ultimoArbolTrabajado: number;
  apiarioNombre: string | null;
  totalColmenas: number | null;
};

/** Un gramo: por debajo de eso no hay báscula en la finca que lo distinga. */
const MINIMO_KG = 0.001;

/** Pasos de la pantalla. En cultivo se arranca siempre en 'inicio'. */
type Paso = 'inicio' | 'confirmar' | 'tramo' | 'sueltos';

function parsearListaNumeros(raw: string): number[] | null {
  const tokens = raw.split(/[\s,;]+/).filter(Boolean);
  const nums: number[] = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    if (n <= 0) return null;
    nums.push(n);
  }
  return nums;
}

const ESTADOS_APIARIO: Array<{ value: EstadoApiario; etiqueta: string; color: string }> = [
  { value: 'BIEN', etiqueta: 'Bien', color: 'bg-estado-aldia text-white border-estado-aldia' },
  {
    value: 'CON_PROBLEMAS',
    etiqueta: 'Con problemas',
    color: 'bg-estado-proxima text-white border-estado-proxima',
  },
  {
    value: 'CRITICO',
    etiqueta: 'Crítico',
    color: 'bg-estado-vencida text-white border-estado-vencida',
  },
];

export function FormAvance({ asignacion }: { asignacion: Asignacion }) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [error, setError] = useState<string | null>(null);
  const [fotoFallo, setFotoFallo] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const esCultivo = asignacion.area === 'CULTIVO';
  const esCosechaMiel = asignacion.esCosechaMiel;
  const esVisitaApiario = !esCultivo && !esCosechaMiel;
  const [paso, setPaso] = useState<Paso>('inicio');
  const [estadoApiario, setEstadoApiario] = useState<EstadoApiario | null>(null);
  const [guardadoSinSenal, setGuardadoSinSenal] = useState(false);

  const total = asignacion.totalArboles ?? 0;
  // El árbol donde arranca el tramo se calcula solo: el trabajador nunca lo escribe.
  const desdeAuto = Math.max(1, Math.min(asignacion.ultimoArbolTrabajado + 1, total || 1));

  function irA(p: Paso) {
    setError(null);
    setFotoFallo(false);
    setPaso(p);
  }

  /** Sube la foto si la hay. Devuelve el path, o `false` si falló el envío. */
  async function resolverFoto(formData: FormData): Promise<string | null | false> {
    const foto = formData.get('foto');
    if (!(foto instanceof File) || foto.size === 0) return null;
    if (!online) return false;
    try {
      const fd = new FormData();
      fd.append('foto', foto);
      const res = await fetch('/api/trabajador/foto-avance', { method: 'POST', body: fd });
      if (!res.ok) return false;
      const j = (await res.json()) as { path?: string };
      return j.path ?? false;
    } catch {
      return false;
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const sinFoto = submitter?.getAttribute('name') === 'sin_foto';
    const observaciones = String(formData.get('observaciones') ?? '').trim() || null;

    if (esCosechaMiel) {
      const kg = parsearDecimal(String(formData.get('kg') ?? ''));
      if (!Number.isFinite(kg) || kg < MINIMO_KG) {
        setError(`Los kilos cosechados deben ser ${MINIMO_KG} o más.`);
        return;
      }
      startTransition(async () => {
        const res = await fetch('/api/trabajador/cosecha-miel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asignacion_id: asignacion.id, kg, notas: observaciones }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? `Error ${res.status}`);
          return;
        }
        router.push(`/trabajador/exito/${asignacion.id}`);
      });
      return;
    }

    // Datos del avance según el camino elegido.
    let tipo_registro: 'TRAMO' | 'SUELTOS' | 'VISITA';
    let arbol_desde: number | null = null;
    let arbol_hasta: number | null = null;
    let arboles_lista: number[] = [];

    if (esVisitaApiario) {
      if (!estadoApiario) {
        setError('Indica cómo encontraste el apiario.');
        return;
      }
      tipo_registro = 'VISITA';
    } else if (paso === 'confirmar') {
      if (total <= 0) {
        setError('Este lote todavía no tiene árboles cargados.');
        return;
      }
      tipo_registro = 'TRAMO';
      arbol_desde = desdeAuto;
      arbol_hasta = total;
    } else if (paso === 'tramo') {
      const h = parseInt(String(formData.get('hasta') ?? ''), 10);
      if (!Number.isInteger(h) || h < 1) {
        setError('Escribe el número del árbol donde quedaste.');
        return;
      }
      if (total > 0 && h > total) {
        setError(`El lote llega hasta el árbol ${total}.`);
        return;
      }
      if (h < desdeAuto) {
        setError(`Ya llevas hasta el árbol ${asignacion.ultimoArbolTrabajado}. Escribe uno mayor.`);
        return;
      }
      tipo_registro = 'TRAMO';
      arbol_desde = desdeAuto;
      arbol_hasta = h;
    } else {
      const lista = parsearListaNumeros(String(formData.get('lista') ?? ''));
      if (!lista || lista.length === 0) {
        setError('Escribe los números de los árboles separados por coma.');
        return;
      }
      if (total > 0) {
        const fuera = lista.filter((n) => n > total);
        if (fuera.length > 0) {
          setError(`El lote llega hasta el árbol ${total}.`);
          return;
        }
      }
      tipo_registro = 'SUELTOS';
      arboles_lista = lista;
    }

    startTransition(async () => {
      let foto_path: string | null = null;
      if (!sinFoto) {
        const resultadoFoto = await resolverFoto(formData);
        if (resultadoFoto === false) {
          setFotoFallo(true);
          return;
        }
        foto_path = resultadoFoto;
      }

      const r = await enviarAvance({
        asignacion_id: asignacion.id,
        tipo_registro,
        arbol_desde,
        arbol_hasta,
        arboles_lista,
        observaciones,
        estado_apiario: esVisitaApiario ? estadoApiario : null,
        foto_path,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.offline) {
        // La pantalla de éxito la arma el servidor a partir de la tarea ya
        // cerrada, y sin señal el servidor todavía no sabe nada de esto: ir
        // para allá dejaba al trabajador en una navegación que no carga.
        setGuardadoSinSenal(true);
        return;
      }
      router.push(`/trabajador/exito/${asignacion.id}`);
    });
  }

  const destino = esCultivo
    ? `Lote ${asignacion.loteNombre}`
    : `Apiario ${asignacion.apiarioNombre}`;

  if (guardadoSinSenal) {
    return (
      <div className="space-y-6 pb-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zelanda-ocre-600/15 text-zelanda-ocre-700">
          <CloudOff className="h-8 w-8" />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-zelanda-verde-900">Guardado en el celular</h1>
          <p className="mx-auto mt-2 max-w-[34ch] text-base text-zelanda-verde-700">
            No hay señal, así que el trabajo quedó anotado acá y se envía solo apenas vuelva
            internet. No hace falta que lo repitas.
          </p>
        </div>
        <Link href="/trabajador" className={botonPrimario}>
          Volver a mis tareas
        </Link>
        <Link href="/trabajador/pendientes" className={botonSecundario}>
          Ver lo que falta enviar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-8" noValidate>
      {paso === 'inicio' ? (
        <Link
          href="/trabajador"
          className="-ml-2 inline-flex min-h-touch items-center gap-1 rounded px-2 py-1 text-base text-zelanda-verde-700 hover:text-zelanda-verde-900"
        >
          <ChevronLeft className="h-5 w-5" />
          Mis tareas
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => irA('inicio')}
          className="-ml-2 inline-flex min-h-touch items-center gap-1 rounded px-2 py-1 text-base text-zelanda-verde-700 hover:text-zelanda-verde-900"
        >
          <ChevronLeft className="h-5 w-5" />
          Atrás
        </button>
      )}

      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-zelanda-verde-700">{destino}</p>
        <h1 className="mt-1 font-serif text-3xl text-zelanda-verde-900">{asignacion.tipoTarea}</h1>
        {esCultivo && total > 0 ? (
          <p className="mt-1.5 text-base text-zelanda-verde-700">
            Llevas {asignacion.arbolesCompletados.toLocaleString('es-CO')} de{' '}
            {total.toLocaleString('es-CO')} árboles
          </p>
        ) : null}
      </header>

      {esCultivo ? (
        <>
          {paso === 'inicio' ? (
            <div className="space-y-4">
              <button type="button" onClick={() => irA('confirmar')} className={botonPrimario}>
                <Check className="h-7 w-7" />
                Terminé toda la tarea
              </button>

              <p className="text-center text-sm text-zelanda-verde-700">¿No la terminaste?</p>

              <button type="button" onClick={() => irA('tramo')} className={botonSecundario}>
                Avancé hasta un árbol
              </button>

              <button
                type="button"
                onClick={() => irA('sueltos')}
                className="mx-auto flex min-h-touch items-center gap-2 text-sm text-zelanda-verde-700 underline underline-offset-4 hover:text-zelanda-verde-900"
              >
                <ListPlus className="h-4 w-4" />
                Otra forma: árboles sueltos
              </button>
            </div>
          ) : null}

          {paso === 'confirmar' ? (
            <section className="space-y-5 rounded-2xl border-2 border-zelanda-verde-300 bg-white p-5 shadow-card">
              <p className="text-center font-serif text-2xl text-zelanda-verde-900">
                ¿Terminaste toda la tarea?
              </p>
              <p className="text-center text-base text-zelanda-verde-700">
                Se va a guardar como terminada y desaparece de tus tareas.
              </p>
              <SubirFoto name="foto" />
              <button type="submit" disabled={pendiente} className={botonPrimario}>
                <Check className="h-7 w-7" />
                {pendiente ? 'Guardando…' : 'Sí, terminé'}
              </button>
              <button type="button" onClick={() => irA('inicio')} className={botonSecundario}>
                No, todavía no
              </button>
            </section>
          ) : null}

          {paso === 'tramo' ? (
            <section className="space-y-5 rounded-2xl border-2 border-zelanda-beige-200 bg-white p-5 shadow-card">
              <p className="text-base text-zelanda-verde-700">
                Vas desde el árbol{' '}
                <strong className="font-serif text-xl text-zelanda-verde-900">{desdeAuto}</strong>
              </p>
              <div>
                <label htmlFor="hasta" className={labelBase}>
                  ¿Hasta qué árbol llegaste?
                </label>
                <input
                  id="hasta"
                  name="hasta"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={desdeAuto}
                  required
                  className={inputBase}
                />
              </div>
              <SubirFoto name="foto" />
              <button type="submit" disabled={pendiente} className={botonPrimario}>
                {pendiente ? 'Guardando…' : 'Registrar'}
              </button>
            </section>
          ) : null}

          {paso === 'sueltos' ? (
            <section className="space-y-5 rounded-2xl border-2 border-zelanda-beige-200 bg-white p-5 shadow-card">
              <div>
                <label htmlFor="lista" className={labelBase}>
                  Números de los árboles
                </label>
                <textarea
                  id="lista"
                  name="lista"
                  rows={3}
                  required
                  placeholder="12, 45, 67"
                  className={`${inputBase} min-h-[100px] resize-y`}
                />
              </div>
              <div>
                <label htmlFor="observaciones" className={labelBase}>
                  Notas (opcional)
                </label>
                <textarea
                  id="observaciones"
                  name="observaciones"
                  rows={2}
                  className={`${inputBase} min-h-[80px] resize-y text-base`}
                />
              </div>
              <SubirFoto name="foto" />
              <button type="submit" disabled={pendiente} className={botonPrimario}>
                {pendiente ? 'Guardando…' : 'Registrar'}
              </button>
            </section>
          ) : null}
        </>
      ) : esCosechaMiel ? (
        <section className="space-y-5 rounded-2xl border-2 border-zelanda-beige-200 bg-white p-5 shadow-card">
          {asignacion.totalColmenas !== null ? (
            <p className="text-base text-zelanda-verde-700">
              {asignacion.totalColmenas} colmenas en el apiario.
            </p>
          ) : null}
          <div>
            <label htmlFor="kg" className={labelBase}>
              ¿Cuántos kilos de miel sacaste?
            </label>
            <input
              id="kg"
              name="kg"
              // `text` y no `number`: con `number`, el teclado en español manda
              // la coma, el navegador da el valor por inválido y entrega el
              // campo vacío. Medio kilo llegaba como cero.
              type="text"
              inputMode="decimal"
              placeholder="0,5"
              required
              className={inputBase}
            />
          </div>
          <div>
            <label htmlFor="observaciones" className={labelBase}>
              Notas (opcional)
            </label>
            <textarea
              id="observaciones"
              name="observaciones"
              rows={3}
              className={`${inputBase} min-h-[80px] resize-y text-base`}
            />
          </div>
          <button type="submit" disabled={pendiente || !online} className={botonPrimario}>
            {pendiente ? 'Guardando…' : 'Registrar'}
          </button>
          <p className="text-center text-sm text-zelanda-verde-700">
            Al registrar, la tarea queda terminada.
          </p>
        </section>
      ) : (
        <section className="space-y-5 rounded-2xl border-2 border-zelanda-beige-200 bg-white p-5 shadow-card">
          {asignacion.totalColmenas !== null ? (
            <p className="text-base text-zelanda-verde-700">
              {asignacion.totalColmenas} colmenas en el apiario.
            </p>
          ) : null}

          <div>
            <p className={labelBase}>¿Cómo encontraste el apiario?</p>
            <div className="mt-2 grid gap-3">
              {ESTADOS_APIARIO.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setEstadoApiario(e.value)}
                  className={`min-h-[64px] rounded-xl border-2 px-4 text-lg font-semibold transition ${
                    estadoApiario === e.value
                      ? e.color
                      : 'border-zelanda-beige-300 bg-white text-zelanda-verde-800'
                  }`}
                >
                  {e.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="observaciones" className={labelBase}>
              Notas (opcional)
            </label>
            <textarea
              id="observaciones"
              name="observaciones"
              rows={3}
              className={`${inputBase} min-h-[80px] resize-y text-base`}
            />
          </div>
          <SubirFoto name="foto" />
          <button type="submit" disabled={pendiente} className={botonPrimario}>
            <Check className="h-7 w-7" />
            {pendiente ? 'Guardando…' : 'Terminé la visita'}
          </button>
        </section>
      )}

      {!online && !esCosechaMiel && paso !== 'inicio' ? (
        <p className="flex items-center gap-2 rounded-xl border-2 border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-3 text-sm text-zelanda-ocre-700">
          <CloudOff className="h-5 w-5 shrink-0" />
          Sin señal. Lo que registres se guarda y sube solo cuando vuelva la señal.
        </p>
      ) : null}

      {!online && esCosechaMiel ? (
        <p className="flex items-center gap-2 rounded-xl border-2 border-estado-vencida/40 bg-estado-vencida/10 px-3 py-3 text-sm text-estado-vencida">
          <CloudOff className="h-5 w-5 shrink-0" />
          Sin señal. La cosecha de miel necesita señal para registrarse.
        </p>
      ) : null}

      {fotoFallo ? (
        <div className="space-y-3 rounded-xl border-2 border-zelanda-ocre-300 bg-zelanda-ocre-50 p-4">
          <p role="alert" className="text-sm text-zelanda-ocre-700">
            No se pudo subir la foto. Intenta otra vez, o guarda el trabajo sin la foto.
          </p>
          <button
            type="submit"
            name="sin_foto"
            value="1"
            disabled={pendiente}
            className={botonSecundario}
          >
            Guardar sin la foto
          </button>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-estado-vencida/20 bg-estado-vencida/10 px-3 py-3 text-base text-estado-vencida"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
