import Link from "next/link";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/app/(auth)/login/acciones";
import { AvatarIniciales } from "./AvatarIniciales";
import { BrandMark } from "./BrandMark";
import { BuscadorGlobal } from "./BuscadorGlobal";
import { ETIQUETA_ROL } from "@/lib/constantes";
import type { UsuarioActual } from "@/lib/auth";

export function HeaderApp({ usuario }: { usuario: UsuarioActual }) {
  return (
    <header
      className="sticky top-0 z-20 border-b border-zelanda-verde-900/20 bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 text-zelanda-beige-50 shadow-suave"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-screen-md items-center gap-2.5 px-4 py-3">
        <BrandMark tamano={34} />
        <Link
          href="/mi-perfil"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-white/10"
          aria-label="Ir a mi perfil"
        >
          <AvatarIniciales
            id={usuario.id}
            nombre={usuario.nombre_completo}
            tamano="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-[15px] leading-tight">
              {usuario.nombre_completo}
            </p>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-beige-100/80">
              {ETIQUETA_ROL[usuario.rol]} · La Zelanda
            </p>
          </div>
        </Link>
        {usuario.rol === "JEFE" ? <BuscadorGlobal /> : null}
        <form action={cerrarSesion}>
          <button
            type="submit"
            aria-label="Cerrar sesión"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-lg p-2 text-zelanda-beige-100 transition hover:bg-white/10"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
