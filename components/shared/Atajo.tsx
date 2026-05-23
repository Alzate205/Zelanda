import Link from "next/link";
import { type LucideIcon } from "lucide-react";

export function Atajo({
  href,
  icono: Icono,
  titulo,
  sub,
}: {
  href: string;
  icono: LucideIcon;
  titulo: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl border border-zelanda-beige-200 bg-white p-3 pb-2.5 text-zelanda-verde-900 shadow-suave transition hover:border-zelanda-verde-300 hover:shadow-card"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-zelanda-verde-50 text-zelanda-verde-700">
        <Icono className="h-[18px] w-[18px]" />
      </span>
      <span className="font-serif text-sm leading-tight">{titulo}</span>
      <span className="text-[11.5px] text-zelanda-verde-700">{sub}</span>
    </Link>
  );
}
