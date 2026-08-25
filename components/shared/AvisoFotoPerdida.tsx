import Link from 'next/link';
import { ImageOff } from 'lucide-react';

/**
 * El registro subió; la foto no, y ya no se puede recuperar.
 *
 * Cuando el servidor rechaza una foto de forma definitiva —viene rota, o pesa
 * más de lo que acepta— la cola suelta el blob y deja subir el registro igual:
 * perder el trabajo del día por una foto sería peor. Pero eso pasaba en
 * silencio, y el trabajador se iba convencido de haber mandado la evidencia de
 * la plaga. Esta pantalla existe para que se entere en el momento, cuando
 * todavía está parado frente al árbol y puede volver a tomarla.
 */
export function AvisoFotoPerdida({ que, volverA }: { que: string; volverA: string }) {
  return (
    <div className="space-y-6 pb-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zelanda-ocre-600/15 text-zelanda-ocre-700">
        <ImageOff className="h-8 w-8" />
      </div>
      <div>
        <h1 className="font-serif text-2xl text-zelanda-verde-900">{que} sin la foto</h1>
        <p className="mx-auto mt-2 max-w-[34ch] text-base text-zelanda-verde-700">
          Quedó registrado, pero la foto no se pudo guardar y ya no está en el celular. Si la
          evidencia hace falta, tomala de nuevo desde el árbol.
        </p>
      </div>
      <Link
        href={volverA}
        className="block min-h-touch rounded-xl bg-zelanda-verde-700 px-4 py-3 font-semibold text-zelanda-beige-50 [box-shadow:0_2px_0_theme(colors.zelanda.verde.900),0_1px_3px_rgba(20,44,26,0.06)]"
      >
        Entendido
      </Link>
    </div>
  );
}
