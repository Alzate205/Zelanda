export const metadata = { title: 'La Zelanda' };

export default function PaginaSplash() {
  return (
    <main
      className="flex min-h-svh items-center justify-center"
      style={{
        background:
          'radial-gradient(circle at 50% 32%, rgba(193,150,88,0.30), transparent 55%),' +
          'linear-gradient(180deg, #1f3a26 0%, #142c1a 100%)',
      }}
    >
      <div className="flex flex-col items-center px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-zelanda.webp"
          alt="La Zelanda"
          style={{
            height: 280,
            filter: 'drop-shadow(0 12px 26px rgba(0,0,0,0.45))',
          }}
        />
        <h1 className="mt-4 font-serif text-3xl tracking-tight text-zelanda-beige-50">
          La Zelanda
        </h1>
        <p className="text-[11px] uppercase tracking-[0.22em] text-zelanda-beige-100/70">
          FincApp · Quindío
        </p>
        <div
          className="mt-12 h-7 w-7 animate-spin rounded-full border-[2.5px] border-white/25"
          style={{ borderTopColor: '#d4b07a' }}
        />
        <p className="mt-3 text-[11.5px] text-zelanda-beige-100/70">Sincronizando con la finca…</p>
      </div>
    </main>
  );
}
