"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Map,
  Users,
  Bell,
  PackageOpen,
  Boxes,
  Warehouse,
  ShoppingBag,
  ListChecks,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RolUsuario } from "@/types";

type ItemNav = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
};

const ITEMS_POR_ROL: Record<RolUsuario, ItemNav[]> = {
  JEFE: [
    { href: "/jefe", etiqueta: "Inicio", icono: Home },
    { href: "/jefe/lotes", etiqueta: "Lotes", icono: Map },
    { href: "/jefe/equipo", etiqueta: "Equipo", icono: Users },
    { href: "/jefe/alertas", etiqueta: "Alertas", icono: Bell },
  ],
  BODEGA: [
    { href: "/bodega", etiqueta: "Inicio", icono: Home },
    { href: "/bodega/despachos", etiqueta: "Despachos", icono: PackageOpen },
    { href: "/bodega/inventario", etiqueta: "Inventario", icono: Boxes },
  ],
  ALMACEN: [
    { href: "/almacen", etiqueta: "Inicio", icono: Home },
    { href: "/almacen/cosecha", etiqueta: "Cosecha", icono: Warehouse },
    { href: "/almacen/salidas", etiqueta: "Salidas", icono: ShoppingBag },
  ],
  TRABAJADOR: [
    { href: "/trabajador", etiqueta: "Inicio", icono: Home },
    { href: "/trabajador/tareas", etiqueta: "Tareas", icono: ListChecks },
    { href: "/trabajador/prestamos", etiqueta: "Bodega", icono: Sprout },
  ],
};

export function BottomNav({ rol }: { rol: RolUsuario }) {
  const pathname = usePathname();
  const items = ITEMS_POR_ROL[rol];

  return (
    <nav className="sticky bottom-0 z-20 border-t border-zelanda-beige-300 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <ul
        className="mx-auto flex max-w-screen-md items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map(({ href, etiqueta, icono: Icono }) => {
          const activo =
            pathname === href ||
            (href !== `/${rol.toLowerCase()}` && pathname.startsWith(`${href}/`));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex min-h-touch flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition",
                  activo
                    ? "text-zelanda-verde-800"
                    : "text-zelanda-verde-700/60 hover:text-zelanda-verde-800",
                )}
              >
                <Icono className="h-5 w-5" strokeWidth={activo ? 2.25 : 1.75} />
                <span className="leading-tight">{etiqueta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
