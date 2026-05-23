import { cn } from "@/lib/utils";

export function Bar({
  valor,
  estado = "aldia",
  className,
}: {
  valor: number;
  estado?: "aldia" | "proxima" | "vencida";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, valor)) * 100;
  const color =
    estado === "vencida"
      ? "bg-estado-vencida"
      : estado === "proxima"
        ? "bg-estado-proxima"
        : "bg-zelanda-verde-600";
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-zelanda-beige-200",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
