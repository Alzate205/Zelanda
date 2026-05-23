import { cn } from "@/lib/utils";

export function Eyebrow({
  children,
  className,
  dark,
}: {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-[10.5px] uppercase tracking-[0.18em]",
        dark ? "text-zelanda-beige-100/80" : "text-zelanda-verde-700",
        className,
      )}
    >
      {children}
    </p>
  );
}
