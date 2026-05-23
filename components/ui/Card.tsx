import { cn } from "@/lib/utils";

export function Card({
  className,
  lift,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { lift?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zelanda-beige-200 bg-white p-4",
        lift ? "shadow-card" : "shadow-suave",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10.5px] uppercase tracking-[0.18em] text-zelanda-verde-700",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "font-serif text-[17px] leading-snug text-zelanda-verde-900",
        className,
      )}
    >
      {children}
    </h3>
  );
}
