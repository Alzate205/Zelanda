import Link from 'next/link';
import { BotonCerrarSesion } from './BotonCerrarSesion';
import { AvatarIniciales } from './AvatarIniciales';
import { BrandMark } from './BrandMark';
import { BotonPanel } from './BotonPanel';
import { ETIQUETA_ROL } from '@/lib/constantes';
import type { UsuarioActual } from '@/lib/auth';

export function HeaderApp({ usuario }: { usuario: UsuarioActual }) {
  // El trabajador ve un header sin perfil ni rol: solo quién es y cómo salir.
  if (usuario.rol === 'TRABAJADOR') {
    return (
      <header
        className="sticky top-0 z-20 border-b border-zelanda-verde-900/20 bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 text-zelanda-beige-50 shadow-suave"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-screen-md items-center gap-2.5 px-4 py-3">
          {/* El logo y el nombre son la salida de vuelta a las tareas: adentro
              de un registro no hay barra de navegación donde apoyarse. */}
          <Link
            href="/trabajador"
            aria-label="Volver a mis tareas"
            className="-mx-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-white/10"
          >
            <BrandMark tamano={34} />
            <span className="min-w-0 flex-1 truncate font-serif text-[17px] leading-tight">
              {usuario.nombre_completo}
            </span>
          </Link>
          <BotonCerrarSesion />
        </div>
      </header>
    );
  }

  return (
    <header
      className="sticky top-0 z-20 border-b border-zelanda-verde-900/20 bg-gradient-to-b from-zelanda-verde-800 to-zelanda-verde-700 text-zelanda-beige-50 shadow-suave"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex max-w-screen-md items-center gap-2.5 px-4 py-3">
        <BrandMark tamano={34} />
        <Link
          href="/mi-perfil"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-white/10"
          aria-label="Ir a mi perfil"
        >
          <AvatarIniciales id={usuario.id} nombre={usuario.nombre_completo} tamano="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-[15px] leading-tight">
              {usuario.nombre_completo}
            </p>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-zelanda-beige-100/80">
              {ETIQUETA_ROL[usuario.rol]} · La Zelanda
            </p>
          </div>
        </Link>
        {usuario.rol === 'JEFE' ? <BotonPanel /> : null}
        <BotonCerrarSesion />
      </div>
    </header>
  );
}
