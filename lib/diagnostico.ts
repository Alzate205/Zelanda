import type { SnapshotJefe } from '@/lib/offline/tipos';
import type { ClimaFinca } from '@/lib/jefe/clima';
import { esTemporadaDeCosecha } from '@/lib/fenologia';

/**
 * Diagnóstico de la finca: cruza el estado operativo (snapshot) con el clima
 * y devuelve alertas accionables ordenadas por severidad.
 *
 * Es determinista y sin efectos: cada alerta declara la evidencia que la
 * disparó, para que nunca aparezca una conclusión sin su dato de origen.
 * Si un dato no está, la regla no dispara — nunca se inventa una alerta.
 */

export type Severidad = 'CRITICO' | 'ALERTA' | 'AVISO';

export type Alerta = {
  id: string;
  severidad: Severidad;
  titulo: string;
  /** El dato crudo que disparó la alerta. */
  evidencia: string;
  accion: string;
  href?: string;
};

/** Días que puede quedar una novedad sin resolver antes de escalar a crítica. */
export const DIAS_NOVEDAD_SIN_RESOLVER = 7;

const ORDEN: Record<Severidad, number> = { CRITICO: 0, ALERTA: 1, AVISO: 2 };

const MS_POR_DIA = 86_400_000;

function diasDesde(iso: string, hoy: Date): number {
  return Math.floor((hoy.getTime() - new Date(iso).getTime()) / MS_POR_DIA);
}

function plural(n: number, singular: string, prefijoPlural = 's'): string {
  return n === 1 ? `1 ${singular}` : `${n} ${singular}${prefijoPlural}`;
}

export function diagnosticar(
  snapshot: SnapshotJefe,
  clima: ClimaFinca | null,
  hoy: Date = new Date()
): Alerta[] {
  const alertas: Alerta[] = [];
  const { contadores } = snapshot;

  if (clima?.hongos.pudricion_raiz) {
    alertas.push({
      id: 'pudricion-raiz',
      severidad: 'CRITICO',
      titulo: 'Riesgo de pudrición de raíz',
      evidencia: `Llovieron ${clima.lluvia_72h_mm} mm en las últimas 72 horas.`,
      accion: 'Revisar drenajes en los lotes bajos y evitar riego hasta que escurra.',
    });
  }

  if (clima?.hongos.antracnosis) {
    alertas.push({
      id: 'antracnosis',
      severidad: 'CRITICO',
      titulo: 'Riesgo de antracnosis',
      evidencia: `Humedad media de ${clima.humedad_media_48h} % con lluvia en las últimas 48 horas.`,
      accion: 'Evaluar preventivo foliar y mejorar aireación con poda si el follaje está denso.',
    });
  }

  if (clima?.reglas.riesgo_helada) {
    const tmin = clima.dias[0]?.tmin;
    alertas.push({
      id: 'helada',
      severidad: 'CRITICO',
      titulo: 'Riesgo de helada esta noche',
      evidencia:
        tmin !== undefined
          ? `La mínima pronosticada es de ${tmin} °C.`
          : 'La mínima pronosticada baja de 2 °C.',
      accion: 'Regar al atardecer para amortiguar la caída de temperatura.',
    });
  }

  const novedadesViejas = snapshot.novedades_pendientes.filter(
    (n) => diasDesde(n.fecha, hoy) > DIAS_NOVEDAD_SIN_RESOLVER
  );
  if (novedadesViejas.length > 0) {
    const masVieja = novedadesViejas.reduce((a, b) =>
      diasDesde(a.fecha, hoy) >= diasDesde(b.fecha, hoy) ? a : b
    );
    alertas.push({
      id: 'novedades-sin-resolver',
      severidad: 'CRITICO',
      titulo: `${plural(novedadesViejas.length, 'novedad', 'es')} sin resolver`,
      evidencia: `La más antigua lleva ${diasDesde(masVieja.fecha, hoy)} días: árbol ${
        masVieja.arbol_numero
      } de ${masVieja.lote_nombre}.`,
      accion: 'Revisar y cerrar las novedades pendientes.',
      href: '/jefe/novedades',
    });
  }

  // El conteo sale de `contadores`, no de `vencidas`: esa lista viene truncada
  // a las 10 más urgentes y contarla daría menos lotes de los que hay.
  if (contadores.lotes_vencida > 0) {
    const ejemplos = snapshot.vencidas
      .slice(0, 3)
      .map((v) => `${v.tipo_nombre} en ${v.lote_nombre}`)
      .join(', ');
    alertas.push({
      id: 'tareas-vencidas',
      severidad: 'ALERTA',
      titulo: `${plural(contadores.lotes_vencida, 'lote')} con tareas vencidas`,
      evidencia: ejemplos ? `Por ejemplo: ${ejemplos}.` : 'Hay tareas fuera de su frecuencia.',
      accion: 'Asignar las tareas atrasadas.',
      href: '/jefe/asignaciones/nueva',
    });
  }

  const carencias = snapshot.carencias_por_lote ?? [];
  if (carencias.length > 0 && esTemporadaDeCosecha(hoy)) {
    const detalle = carencias
      .slice(0, 2)
      .map((c) => `${c.insumo} hasta ${c.hasta}`)
      .join(', ');
    alertas.push({
      id: 'carencia-en-cosecha',
      severidad: 'ALERTA',
      titulo: `${plural(carencias.length, 'lote')} en período de carencia`,
      evidencia: `Estamos en temporada de cosecha y hay carencia activa: ${detalle}.`,
      accion: 'No recolectar en esos lotes hasta que venza la carencia.',
      href: '/jefe/aplicaciones',
    });
  }

  if (contadores.stock_bajo > 0) {
    alertas.push({
      id: 'stock-bajo',
      severidad: 'ALERTA',
      titulo: `${plural(contadores.stock_bajo, 'insumo')} bajo el mínimo`,
      evidencia: 'El stock disponible quedó por debajo del mínimo configurado.',
      accion: 'Programar compra antes de que falte en campo.',
      href: '/jefe/compras/nueva',
    });
  }

  if (clima?.reglas.ventana_fumigacion) {
    alertas.push({
      id: 'ventana-fumigacion',
      severidad: 'AVISO',
      titulo: 'Buena ventana para fumigar',
      evidencia: clima.reglas.motivo,
      accion: 'Aprovechar hoy si hay aplicaciones pendientes.',
      href: '/jefe/asignaciones/nueva',
    });
  }

  if (contadores.despachos_abiertos > 0) {
    alertas.push({
      id: 'despachos-abiertos',
      severidad: 'AVISO',
      titulo: `${plural(contadores.despachos_abiertos, 'despacho')} sin cerrar`,
      evidencia: 'Hay herramientas prestadas sin registrar devolución.',
      accion: 'Recordar a bodega que cierre el despacho al final del día.',
    });
  }

  return alertas.sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);
}
