import { cn } from "@/lib/utils";

function obtenerIniciales(nombreCompleto: string): string {
  const palabras = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

function gradienteDeId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 32% 38%), hsl(${h2} 28% 24%))`;
}

type Props = {
  id: string;
  nombre: string;
  tamano?: "sm" | "md" | "lg";
  className?: string;
};

export function AvatarIniciales({
  id,
  nombre,
  tamano = "md",
  className,
}: Props) {
  const dimensiones = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  }[tamano];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-medium text-white shadow-suave",
        dimensiones,
        className,
      )}
      style={{ backgroundImage: gradienteDeId(id) }}
      aria-hidden="true"
    >
      {obtenerIniciales(nombre)}
    </div>
  );
}
