"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sprout } from "lucide-react";

export function BuscadorArbol({
  loteId,
  totalArboles,
}: {
  loteId: string;
  totalArboles: number;
}) {
  const router = useRouter();
  const [num, setNum] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!/^\d+$/.test(num)) {
      setError("Ingresá un número entero.");
      return;
    }
    const n = parseInt(num, 10);
    if (n < 1 || n > totalArboles) {
      setError(`El número debe estar entre 1 y ${totalArboles}.`);
      return;
    }
    router.push(`/jefe/lotes/${loteId}/arbol/${n}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zelanda-beige-200 bg-white p-5 shadow-card"
    >
      <h2 className="flex items-center gap-2 font-serif text-base text-zelanda-verde-900">
        <Sprout className="h-4 w-4 text-zelanda-verde-600" />
        Ficha de árbol
      </h2>
      <p className="mt-1 text-xs text-zelanda-verde-700">
        Consultá el historial completo de un árbol específico.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max={totalArboles}
          placeholder={`1 a ${totalArboles}`}
          value={num}
          onChange={(e) => setNum(e.target.value)}
          className="min-h-touch flex-1 rounded-lg border border-zelanda-beige-300 px-3 py-2 text-base"
        />
        <button
          type="submit"
          className="min-h-touch rounded-lg bg-zelanda-verde-700 px-5 text-sm font-medium text-zelanda-beige-50 transition hover:bg-zelanda-verde-800"
        >
          Ver
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-estado-vencida">{error}</p>
      ) : null}
    </form>
  );
}
