import type { Severidad } from '@/lib/diagnostico';

/**
 * Informe de la finca en texto plano, pensado para copiarse y pegarse en una
 * conversación con Claude.
 *
 * `redactarInforme` es pura: recibe datos ya recolectados y devuelve el texto.
 * Sin BD ni red, así se testea entera — mismo patrón que `validar-sql.ts`,
 * `diagnostico.ts` y `fenologia.ts`.
 *
 * La anonimización de personas vive aquí a propósito: si viviera en la capa de
 * consulta, un cambio en esa capa podría dejar salir nombres sin que ningún
 * test lo notara.
 */

export type AlertaInforme = {
  id: string;
  severidad: Severidad;
  titulo: string;
  evidencia: string;
  accion: string;
};

export type TareaInforme = {
  lote_id: string;
  lote_nombre: string;
  tipo_id: string;
  tipo_nombre: string;
  dias_para_proxima: number | null;
  estado: 'vencida' | 'sin_historial' | 'proxima';
};

export type NovedadInforme = {
  id: string;
  tipo: string;
  arbol_numero: number;
  lote_nombre: string;
  fecha: string;
};

export type LoteInforme = {
  nombre: string;
  hectareas: number | null;
  total_arboles: number;
  cosecha_anio_kg: number;
  prediccion_kg: number | null;
};

export type FenologiaInforme = {
  principal: string;
  secundaria: string | null;
  recomendaciones: string[];
};

export type ClimaInforme = {
  lluvia_7dias_mm: number;
  dias: Array<{
    fecha: string;
    tmin: number;
    tmax: number;
    lluvia_mm: number;
    prob_lluvia: number;
  }>;
  notas: string[];
};

export type DatosInforme = {
  fecha_corte: string;
  alertas: AlertaInforme[];
  contadores: {
    total_lotes: number;
    total_arboles: number;
    hectareas: number;
    lotes_aldia: number;
    lotes_proxima: number;
    lotes_vencida: number;
    tareas_activas: number;
    tareas_cerradas_hoy: number;
    cosecha_mes_kg: number;
    cosecha_mes_anterior_kg: number;
    stock_almacen_kg: number;
    stock_bajo: number;
    despachos_abiertos: number;
  };
  vencidas: TareaInforme[];
  proximas: TareaInforme[];
  novedades_pendientes: NovedadInforme[];
  carencias: Array<{ lote_id: string; insumo: string; hasta: string }>;
  lotes: LoteInforme[];
  cosecha_por_anio: Array<{ anio: number; kg: number }>;
  clima: ClimaInforme | null;
  fenologia: FenologiaInforme | null;
  inventario_bajo: Array<{
    nombre: string;
    disponible: number;
    minimo: number;
    unidad: string;
  }>;
  finanzas: {
    meses: Array<{ mes: string; ingresos: number; costos: number }>;
    ventas_por_cliente: Array<{ cliente: string; kg: number; ingresos: number }>;
    compras_por_proveedor: Array<{ proveedor: string; total: number }>;
    nomina: {
      devengado: number;
      pagado: number;
      /** Los nombres entran aquí y NO salen en el texto: se numeran. */
      personas: Array<{ nombre: string; devengado: number; pagado: number }>;
    };
  };
};

const SEVERIDAD_ETIQUETA: Record<Severidad, string> = {
  CRITICO: 'CRÍTICO',
  ALERTA: 'ALERTA',
  AVISO: 'AVISO',
};

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function num(n: number, decimales = 0): string {
  return n.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function pesos(n: number): string {
  return `$${num(Math.round(n))}`;
}

/** '2026-08-14' → '14 de agosto de 2026'. Sin `Date`, para no depender de zona horaria. */
function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  if (!a || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** '2026-07' → 'julio 2026'. */
function mesLargo(iso: string): string {
  const [a, m] = iso.split('-').map((x) => parseInt(x, 10));
  if (!a || !m) return iso;
  return `${MESES[m - 1]} ${a}`;
}

function seccion(titulo: string, cuerpo: string[]): string[] {
  return ['', `## ${titulo}`, '', ...cuerpo];
}

function encabezado(d: DatosInforme): string[] {
  const c = d.contadores;
  return [
    '# Hacienda La Zelanda — estado de la finca',
    '',
    `**Fecha de corte:** ${fechaLarga(d.fecha_corte)} (${d.fecha_corte})`,
    '',
    'Este informe es una **foto** del momento en que se generó. Si hoy es una fecha',
    'posterior, ten en cuenta que los datos pueden haber cambiado y dilo si es relevante',
    'para la respuesta.',
    '',
    '## Contexto',
    '',
    'Finca familiar de aguacate Hass en el Quindío, Colombia. Un solo cultivo, sin otras',
    `variedades. ${c.total_lotes} lotes nombrados con municipios del Quindío,`,
    `${num(c.total_arboles)} árboles en ${num(c.hectareas, 1)} hectáreas. Topografía`,
    'montañosa, hileras siguiendo curvas de nivel.',
    '',
    'Quiero que actúes como asesor agronómico y de gestión de esta finca. Con los datos',
    'de abajo:',
    '',
    '- Dime qué es lo más urgente y por qué, en orden de prioridad.',
    '- Señala lo que se ve mal aunque no lo haya preguntado.',
    '- Cuando recomiendes algo, di qué esperarías ver si funciona.',
    '',
    '**No inventes datos.** Si te falta algo para responder bien, dilo y pídemelo en vez',
    'de suponerlo. Los montos están en pesos colombianos.',
  ];
}

function bloqueAlertas(d: DatosInforme): string[] {
  if (d.alertas.length === 0) {
    return seccion('1. Alertas', ['Sin alertas activas.']);
  }
  const lineas = d.alertas.map(
    (a) =>
      `- **[${SEVERIDAD_ETIQUETA[a.severidad]}] ${a.titulo}** — ${a.evidencia} ` +
      `Acción sugerida por el sistema: ${a.accion}`
  );
  return seccion('1. Alertas', lineas);
}

function bloqueTareas(d: DatosInforme): string[] {
  const c = d.contadores;
  const cuerpo: string[] = [
    `Lotes al día: ${c.lotes_aldia} · con tarea próxima: ${c.lotes_proxima} · vencidas: ${c.lotes_vencida}`,
    `Asignaciones activas: ${c.tareas_activas} · cerradas hoy: ${c.tareas_cerradas_hoy}`,
    '',
    `**Vencidas (${d.vencidas.length}):**`,
  ];
  cuerpo.push(
    ...(d.vencidas.length === 0
      ? ['Ninguna.']
      : d.vencidas.map((t) => {
          const dias = t.dias_para_proxima;
          const detalle =
            t.estado === 'sin_historial'
              ? 'sin registro previo'
              : dias === null
              ? 'sin fecha'
              : `vencida hace ${Math.abs(dias)} días`;
          return `- ${t.lote_nombre} · ${t.tipo_nombre} — ${detalle}`;
        }))
  );
  cuerpo.push('', `**Próximas a vencer (${d.proximas.length}):**`);
  cuerpo.push(
    ...(d.proximas.length === 0
      ? ['Ninguna.']
      : d.proximas.map(
          (t) => `- ${t.lote_nombre} · ${t.tipo_nombre} — en ${t.dias_para_proxima ?? '?'} días`
        ))
  );
  return seccion('2. Tareas', cuerpo);
}

function bloqueProduccion(d: DatosInforme): string[] {
  const c = d.contadores;
  const cuerpo: string[] = [
    `Cosecha del mes en curso: ${num(c.cosecha_mes_kg)} kg (mes anterior: ${num(
      c.cosecha_mes_anterior_kg
    )} kg)`,
    `Stock actual en almacén: ${num(c.stock_almacen_kg)} kg`,
    '',
    '**Por lote (año en curso):**',
    '',
    '| Lote | Hectáreas | Árboles | Cosecha año (kg) | kg/ha | kg/árbol | Predicción (kg) |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  if (d.lotes.length === 0) {
    cuerpo.push('| _sin datos_ | | | | | | |');
  } else {
    for (const l of d.lotes) {
      const kgHa = l.hectareas && l.hectareas > 0 ? num(l.cosecha_anio_kg / l.hectareas) : '—';
      const kgArbol = l.total_arboles > 0 ? num(l.cosecha_anio_kg / l.total_arboles, 1) : '—';
      cuerpo.push(
        `| ${l.nombre} | ${l.hectareas === null ? '—' : num(l.hectareas, 1)} | ` +
          `${num(l.total_arboles)} | ${num(l.cosecha_anio_kg)} | ${kgHa} | ${kgArbol} | ` +
          `${l.prediccion_kg === null ? '—' : num(l.prediccion_kg)} |`
      );
    }
  }
  cuerpo.push('', '**Por año:**');
  cuerpo.push(
    ...(d.cosecha_por_anio.length === 0
      ? ['Sin histórico cargado.']
      : d.cosecha_por_anio.map((a) => `- ${a.anio}: ${num(a.kg)} kg`))
  );
  return seccion('3. Producción', cuerpo);
}

function bloqueSanidad(d: DatosInforme): string[] {
  const cuerpo: string[] = [`**Novedades sin resolver (${d.novedades_pendientes.length}):**`];
  cuerpo.push(
    ...(d.novedades_pendientes.length === 0
      ? ['Ninguna.']
      : d.novedades_pendientes.map(
          (n) =>
            `- ${n.tipo} · árbol ${n.arbol_numero} en ${n.lote_nombre} — reportada ${n.fecha.slice(
              0,
              10
            )}`
        ))
  );
  cuerpo.push('', '**Periodos de carencia activos:**');
  cuerpo.push(
    ...(d.carencias.length === 0
      ? ['Ninguno: no hay lotes con restricción para cosechar.']
      : d.carencias.map((c) => `- ${c.insumo} — no cosechar hasta ${c.hasta}`))
  );
  return seccion('4. Sanidad', cuerpo);
}

function bloqueClima(d: DatosInforme): string[] {
  if (!d.clima) {
    return seccion('5. Clima', ['No se pudo consultar el pronóstico.']);
  }
  const cuerpo: string[] = [
    `Lluvia acumulada últimos 7 días: ${num(d.clima.lluvia_7dias_mm, 1)} mm`,
    '',
    '| Fecha | Mín (°C) | Máx (°C) | Lluvia (mm) | Prob. lluvia |',
    '| --- | --- | --- | --- | --- |',
    ...d.clima.dias.map(
      (x) =>
        `| ${x.fecha} | ${num(x.tmin, 1)} | ${num(x.tmax, 1)} | ${num(x.lluvia_mm, 1)} | ${
          x.prob_lluvia
        }% |`
    ),
  ];
  if (d.clima.notas.length > 0) {
    cuerpo.push('', '**Lecturas agronómicas del sistema:**');
    cuerpo.push(...d.clima.notas.map((n) => `- ${n}`));
  }
  return seccion('5. Clima (próximos días)', cuerpo);
}

function bloqueFenologia(d: DatosInforme): string[] {
  if (!d.fenologia) {
    return seccion('6. Fenología', ['Sin fase determinada.']);
  }
  const cuerpo = [
    `Fase principal del mes: **${d.fenologia.principal}**` +
      (d.fenologia.secundaria ? ` (secundaria: ${d.fenologia.secundaria})` : ''),
  ];
  if (d.fenologia.recomendaciones.length > 0) {
    cuerpo.push('', 'Labores típicas de esta fase:');
    cuerpo.push(...d.fenologia.recomendaciones.map((r) => `- ${r}`));
  }
  return seccion('6. Fenología', cuerpo);
}

function bloqueInventario(d: DatosInforme): string[] {
  const cuerpo: string[] = [
    `Despachos de bodega abiertos sin cerrar: ${d.contadores.despachos_abiertos}`,
    '',
    `**Insumos bajo el mínimo (${d.inventario_bajo.length}):**`,
  ];
  cuerpo.push(
    ...(d.inventario_bajo.length === 0
      ? ['Ninguno.']
      : d.inventario_bajo.map(
          (i) =>
            `- ${i.nombre}: quedan ${num(i.disponible, 1)} ${i.unidad} (mínimo ${num(
              i.minimo,
              1
            )} ${i.unidad})`
        ))
  );
  return seccion('7. Inventario', cuerpo);
}

function bloqueFinanzas(d: DatosInforme): string[] {
  const f = d.finanzas;
  const cuerpo: string[] = [
    '**Ingresos, costos y margen por mes:**',
    '',
    '| Mes | Ingresos | Costos | Margen |',
    '| --- | --- | --- | --- |',
  ];
  if (f.meses.length === 0) {
    cuerpo.push('| _sin movimientos_ | | | |');
  } else {
    for (const m of f.meses) {
      const margen = m.ingresos - m.costos;
      cuerpo.push(
        `| ${mesLargo(m.mes)} | ${pesos(m.ingresos)} | ${pesos(m.costos)} | ${pesos(margen)} |`
      );
    }
  }

  cuerpo.push('', '**Ventas por cliente:**');
  cuerpo.push(
    ...(f.ventas_por_cliente.length === 0
      ? ['Sin ventas registradas en el período.']
      : f.ventas_por_cliente.map((v) => `- ${v.cliente}: ${num(v.kg)} kg por ${pesos(v.ingresos)}`))
  );

  cuerpo.push('', '**Compras por proveedor:**');
  cuerpo.push(
    ...(f.compras_por_proveedor.length === 0
      ? ['Sin compras registradas en el período.']
      : f.compras_por_proveedor.map((c) => `- ${c.proveedor}: ${pesos(c.total)}`))
  );

  const pendiente = f.nomina.devengado - f.nomina.pagado;
  cuerpo.push(
    '',
    '**Nómina del mes en curso:**',
    `Devengado ${pesos(f.nomina.devengado)} · pagado ${pesos(f.nomina.pagado)} · pendiente ${pesos(
      pendiente
    )}`,
    ''
  );
  if (f.nomina.personas.length === 0) {
    cuerpo.push('Sin personas con movimientos este mes.');
  } else {
    // Los nombres reales no salen del sistema: solo el patrón de pagos importa
    // para las preguntas de costo laboral.
    cuerpo.push('Por persona (anonimizado):');
    f.nomina.personas.forEach((p, i) => {
      cuerpo.push(
        `- Trabajador ${i + 1}: devengado ${pesos(p.devengado)} · pagado ${pesos(p.pagado)} · ` +
          `pendiente ${pesos(p.devengado - p.pagado)}`
      );
    });
  }
  return seccion('8. Finanzas', cuerpo);
}

function cierre(): string[] {
  return [
    '',
    '## Cómo puedo ayudarte con esto',
    '',
    'Algunas preguntas que puedo responder con estos datos:',
    '',
    '- ¿Qué debería atender primero esta semana?',
    '- ¿Cuál es el lote más y el menos rentable, y por qué?',
    '- ¿La cosecha de este año va mejor o peor que la del anterior?',
    '- ¿El gasto en insumos se justifica con lo que produjeron esos lotes?',
    '- ¿Qué me está costando plata sin que yo lo esté viendo?',
    '',
    'Pregúntame lo que quieras sobre la finca.',
  ];
}

export function redactarInforme(d: DatosInforme): string {
  return [
    ...encabezado(d),
    ...bloqueAlertas(d),
    ...bloqueTareas(d),
    ...bloqueProduccion(d),
    ...bloqueSanidad(d),
    ...bloqueClima(d),
    ...bloqueFenologia(d),
    ...bloqueInventario(d),
    ...bloqueFinanzas(d),
    ...cierre(),
  ].join('\n');
}
