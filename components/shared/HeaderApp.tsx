import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/app/(auth)/login/acciones";
import { AvatarIniciales } from "./AvatarIniciales";
import { ETIQUETA_ROL } from "@/lib/constantes";
import type { UsuarioActual } from "@/lib/auth";

export function HeaderApp({ usuario }: { usuario: UsuarioActual }) {
  return (
    <header className="sticky top-0 z-20 border-b border-zelanda-verde-900/20 bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 text-zelanda-beige-50 shadow-suave">
      <div className="mx-auto flex max-w-screen-md items-center gap-3 px-4 py-3">
        <AvatarIniciales
          id={usuario.id}
          nombre={usuario.nombre_completo}
          tamano="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base leading-tight">
            {usuario.nombre_completo}
          </p>
          <p className="text-xs uppercase tracking-wider text-zelanda-beige-100/80">
            {ETIQUETA_ROL[usuario.rol]} · La Zelanda
          </p>
        </div>
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
