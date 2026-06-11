import Image from 'next/image';
import { cn } from '@/lib/utils';

export function EmptyState({
  titulo,
  descripcion,
  acciones,
  tamano = 'md',
  className,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  tamano?: 'sm' | 'md';
  className?: string;
}) {
  const dim = tamano === 'sm' ? 120 : 200;
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}
    >
      <Image
        src="/logo-zelanda.webp"
        alt=""
        width={dim}
        height={Math.round(dim * 1.68)}
        className="opacity-95 drop-shadow-md"
        style={{ height: dim, width: 'auto' }}
      />
      <h2 className="mt-4 font-serif text-[22px] text-zelanda-verde-900">{titulo}</h2>
      {descripcion ? (
        <p className="mt-1 max-w-[280px] text-sm text-zelanda-verde-700">{descripcion}</p>
      ) : null}
      {acciones ? (
        <div className="mt-5 flex w-full max-w-[280px] flex-col gap-2">{acciones}</div>
      ) : null}
    </div>
  );
}
