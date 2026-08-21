'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

/**
 * Barra con un botón "Listo" encima del teclado del celular.
 *
 * En el iPhone, el ✓ que iOS pone sobre el teclado no siempre lo cierra: en las
 * pantallas del jefe funciona y en las de registro del trabajador no. No se
 * pudo dar con el motivo sin el aparato, así que la app pone su propio botón,
 * que sí depende de nosotros: quita el foco del campo y con eso el teclado baja.
 *
 * Solo aparece en pantallas táctiles y mientras haya un campo enfocado.
 *
 * Un formulario puede pedir que no salga marcándose con `data-sin-barra-listo`:
 * en formularios cortos la barra queda encima del botón de guardar y estorba
 * más de lo que ayuda. Se declara en el formulario y no en una lista de rutas
 * acá para que la excepción viaje con el que la necesita.
 */
export function BarraListoTeclado() {
  const [visible, setVisible] = useState(false);
  const [fondo, setFondo] = useState(0);

  useEffect(() => {
    // En escritorio el teclado no tapa nada y la barra sobraría.
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;

    const esCampo = (el: Element | null) =>
      !!el &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') &&
      !el.closest('[data-sin-barra-listo]');

    const alEnfocar = (e: FocusEvent) => setVisible(esCampo(e.target as Element));
    const alSalir = () => {
      // Al saltar de un campo a otro, el blur llega antes que el focus nuevo.
      setTimeout(() => setVisible(esCampo(document.activeElement)), 0);
    };

    // El teclado no cambia `innerHeight` en iOS, pero sí encoge el viewport
    // visual: esa diferencia es exactamente lo que hay que subir la barra.
    const vv = window.visualViewport;
    const medir = () => {
      if (!vv) return setFondo(0);
      setFondo(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };

    document.addEventListener('focusin', alEnfocar);
    document.addEventListener('focusout', alSalir);
    vv?.addEventListener('resize', medir);
    vv?.addEventListener('scroll', medir);
    medir();

    return () => {
      document.removeEventListener('focusin', alEnfocar);
      document.removeEventListener('focusout', alSalir);
      vv?.removeEventListener('resize', medir);
      vv?.removeEventListener('scroll', medir);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-end border-t border-zelanda-beige-300 bg-zelanda-beige-100/95 px-3 py-2 backdrop-blur"
      style={{ bottom: fondo }}
    >
      <button
        type="button"
        // `onMouseDown` y no `onClick`: al tocar, el navegador quita el foco
        // antes de que el clic llegue, y el botón desaparecería sin hacer nada.
        onMouseDown={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur();
          setVisible(false);
        }}
        className="flex min-h-touch items-center gap-2 rounded-xl bg-zelanda-verde-700 px-5 font-semibold text-zelanda-beige-50"
      >
        <Check className="h-[18px] w-[18px]" />
        Listo
      </button>
    </div>
  );
}
