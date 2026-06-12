'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function FiltroLote({ lotes }: { lotes: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const actual = sp.get('lote') ?? '';

  function cambiar(valor: string) {
    const params = new URLSearchParams(sp.toString());
    if (valor === '') params.delete('lote');
    else params.set('lote', valor);
    router.push(`/jefe/aplicaciones?${params.toString()}`);
  }

  return (
    <select
      value={actual}
      onChange={(e) => cambiar(e.target.value)}
      aria-label="Filtrar por lote"
      className="min-h-touch rounded-[10px] border border-zelanda-beige-300 bg-white px-2.5 py-1.5 text-[13px] text-zelanda-verde-900 outline-none focus:outline focus:outline-2 focus:outline-zelanda-verde-400"
    >
      <option value="">Todos los lotes</option>
      {lotes.map((l) => (
        <option key={l.id} value={l.id}>
          {l.nombre}
        </option>
      ))}
    </select>
  );
}
