export type RangoFechas = {
  desde: Date | null;
  hasta: Date | null;
};

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function parseRangoFechas(
  searchParams: Record<string, string | string[] | undefined>,
): RangoFechas {
  const desdeRaw =
    typeof searchParams.desde === "string" ? searchParams.desde : "";
  const hastaRaw =
    typeof searchParams.hasta === "string" ? searchParams.hasta : "";

  let desde: Date | null = null;
  let hasta: Date | null = null;

  if (PATRON_FECHA.test(desdeRaw)) {
    const d = new Date(`${desdeRaw}T00:00:00`);
    if (!Number.isNaN(d.getTime())) desde = d;
  }

  if (PATRON_FECHA.test(hastaRaw)) {
    const d = new Date(`${hastaRaw}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) hasta = d;
  }

  return { desde, hasta };
}

export function whereFecha(
  campo: string,
  rango: RangoFechas,
): Record<string, { gte?: Date; lte?: Date }> {
  if (!rango.desde && !rango.hasta) return {};
  const cond: { gte?: Date; lte?: Date } = {};
  if (rango.desde) cond.gte = rango.desde;
  if (rango.hasta) cond.lte = rango.hasta;
  return { [campo]: cond };
}

export function aIso(d: Date | null): string {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
