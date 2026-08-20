import Image from 'next/image';
import { cn } from '@/lib/utils';
import { LOGO_SRC, dimensionesLogo } from '@/lib/marca';

export function BrandMark({ tamano = 34, className }: { tamano?: number; className?: string }) {
  return (
    <span
      aria-label="La Zelanda"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[10px]',
        'bg-gradient-to-b from-zelanda-beige-100 to-zelanda-beige-300',
        '[box-shadow:inset_0_-1px_0_rgba(20,44,26,0.06)]',
        className
      )}
      style={{ width: tamano, height: tamano }}
    >
      <Image
        src={LOGO_SRC}
        alt=""
        {...dimensionesLogo(tamano - 4)}
        priority={false}
        style={{ height: tamano - 4, width: 'auto' }}
      />
    </span>
  );
}
