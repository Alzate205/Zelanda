import { cn } from "@/lib/utils";
import { forwardRef, ButtonHTMLAttributes } from "react";

type Variante = "primary" | "secondary" | "ghost" | "ocre" | "destructive";
type Tamano = "sm" | "md";

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  bloque?: boolean;
}

const VARIANTES: Record<Variante, string> = {
  primary:
    "bg-zelanda-verde-700 text-zelanda-beige-50 " +
    "hover:bg-zelanda-verde-800 " +
    "[box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]",
  secondary:
    "bg-zelanda-beige-100 text-zelanda-verde-800 border border-zelanda-beige-300 " +
    "hover:bg-zelanda-beige-200",
  ghost: "bg-transparent text-zelanda-verde-800 hover:bg-zelanda-beige-100",
  ocre:
    "bg-zelanda-ocre-500 text-zelanda-beige-50 " +
    "[box-shadow:0_2px_0_theme(colors.zelanda.ocre.700),0_1px_3px_rgba(20,44,26,0.06)]",
  destructive:
    "bg-[#f4dad7] text-[#7b2a23] border border-[#e8b3ad] hover:bg-[#efc7c2]",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "min-h-[36px] px-3 text-[13.5px] rounded-[10px]",
  md: "min-h-touch px-4 text-[15px] rounded-xl",
};

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  {
    variante = "primary",
    tamano = "md",
    bloque,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        VARIANTES[variante],
        TAMANOS[tamano],
        bloque && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
