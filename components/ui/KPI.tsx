import { cn } from "@/lib/utils";

export function KPI({
  etiqueta,
  valor,
  pie,
  acento = "verde",
  href,
  className,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  pie?: React.ReactNode;
  acento?: "verde" | "ocre";
  href?: string;
  className?: string;
}) {
  const clases = cn(
    "flex flex-col rounded-2xl border p-3 shadow-suave transition",
    acento === "ocre"
      ? "border-zelanda-ocre-200 bg-zelanda-ocre-50 hover:border-zelanda-ocre-300"
      : "border-zelanda-beige-200 bg-white hover:border-zelanda-verde-300",
    className,
  );

  const contenido = (
    <>
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-verde-700">
        {etiqueta}
      </span>
      <span className="mt-0.5 font-serif text-[28px] leading-none text-zelanda-verde-900">
        {valor}
      </span>
      {pie ? (
        <span className="mt-1 text-xs text-zelanda-verde-700">{pie}</span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={clases}>
        {contenido}
      </a>
    );
  }

  return <div className={clases}>{contenido}</div>;
}
