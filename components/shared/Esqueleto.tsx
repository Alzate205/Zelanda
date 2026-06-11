export function Esqueleto({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-zelanda-beige-200/70 ${className}`} aria-hidden />
  );
}

/** Esqueleto genérico de pantalla: header + cards. */
export function EsqueletoPantalla() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando">
      <div className="space-y-2">
        <Esqueleto className="h-3 w-24" />
        <Esqueleto className="h-7 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Esqueleto className="h-20" />
        <Esqueleto className="h-20" />
      </div>
      <Esqueleto className="h-32" />
      <Esqueleto className="h-32" />
      <Esqueleto className="h-32" />
    </div>
  );
}
