import { cn } from "@/lib/utils";

export function Stepper({
  pasos,
  actual,
  className,
}: {
  pasos: number;
  actual: number;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1", className)}>
      {Array.from({ length: pasos }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i + 1 <= actual ? "bg-zelanda-ocre-300" : "bg-white/20",
          )}
        />
      ))}
    </div>
  );
}
