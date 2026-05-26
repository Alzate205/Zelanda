'use client';

import dynamic from 'next/dynamic';

const FormularioCosecha = dynamic(
  () => import('./cosecha/nueva/_formulario').then((m) => m.FormularioCosecha),
  {
    loading: () => (
      <div className="rounded-xl border border-zelanda-beige-300 bg-zelanda-beige-100 px-4 py-8 text-center text-sm text-zelanda-verde-700">
        Cargando formulario…
      </div>
    ),
  }
);

export function FormularioCosechaWrapper(props: React.ComponentProps<typeof FormularioCosecha>) {
  return <FormularioCosecha {...props} />;
}
