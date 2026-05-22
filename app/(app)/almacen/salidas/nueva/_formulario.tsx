"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { enviarSalida } from "@/lib/offline/api-cliente";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type Tipo = "VENTA" | "CONSUMO" | "PERDIDA" | "OTRO";

export function FormularioSalida({ stockMax }: { stockMax: number }) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<Tipo>("VENTA");
  const [cantidad, setCantidad] = useState("");
  const [cliente, setCliente] = useState("");
  const [precio, setPrecio] = useState("");
  const [notas, setNotas] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const c = Number(cantidad);
    if (!Number.isFinite(c) || c <= 0) {
      setError("Cantidad debe ser positiva.");
      return;
    }
    if (c > stockMax) {
      setError(`Stock insuficiente. Disponible: ${stockMax.toFixed(2)} kg`);
      return;
    }

    const clienteFinal = cliente.trim() || null;
    if (tipo === "VENTA" && !clienteFinal) {
      setError("Para ventas, indica el cliente.");
      return;
    }

    let precioFinal: number | null = null;
    if (tipo === "VENTA" && precio.trim()) {
      const p = Number(precio);
      if (!Number.isFinite(p) || p <= 0) {
        setError("Precio total debe ser positivo.");
        return;
      }
      precioFinal = p;
    }

    startTransition(async () => {
      const r = await enviarSalida({
        tipo,
        cantidad_kg: c,
        cliente_detalle: clienteFinal,
        precio_total: precioFinal,
        notas: notas.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/almacen/salidas");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <p className="block text-sm font-medium text-zelanda-verde-900">Tipo</p>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["VENTA", "CONSUMO", "PERDIDA", "OTRO"] as const).map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                tipo === t
                  ? "border-zelanda-verde-700 bg-zelanda-verde-700 text-white"
                  : "border-zelanda-beige-300"
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => setTipo(t)}
                className="sr-only"
              />
              {t === "VENTA"
                ? "Venta"
                : t === "CONSUMO"
                  ? "Consumo"
                  : t === "PERDIDA"
                    ? "Pérdida"
                    : "Otro"}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="cantidad" className="block text-sm font-medium text-zelanda-verde-900">
          Cantidad (kg)
        </label>
        <input
          id="cantidad"
          type="number"
          inputMode="decimal"
          min="0.01"
          max={stockMax}
          step="0.01"
          required
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {tipo === "VENTA" && (
        <>
          <div>
            <label htmlFor="cliente" className="block text-sm font-medium text-zelanda-verde-900">
              Cliente
            </label>
            <input
              id="cliente"
              required
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre exportador / comprador"
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="precio" className="block text-sm font-medium text-zelanda-verde-900">
              Precio total (COP, opcional)
            </label>
            <input
              id="precio"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="1"
              step="1"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
            />
          </div>
        </>
      )}

      {tipo !== "VENTA" && (
        <div>
          <label htmlFor="detalle" className="block text-sm font-medium text-zelanda-verde-900">
            Detalle (opcional)
          </label>
          <input
            id="detalle"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="ej: consumo casa principal"
            className="mt-1 block w-full min-h-touch rounded-lg border border-zelanda-beige-300 px-3 py-2"
          />
        </div>
      )}

      <div>
        <label htmlFor="notas" className="block text-sm font-medium text-zelanda-verde-900">
          Notas (opcional)
        </label>
        <textarea
          id="notas"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zelanda-beige-300 px-3 py-2"
        />
      </div>

      {!online ? (
        <p className="flex items-center gap-2 rounded-md border border-zelanda-ocre-300 bg-zelanda-ocre-50 px-3 py-2 text-xs text-zelanda-ocre-700">
          <CloudOff className="h-3.5 w-3.5" />
          Sin señal — la salida se guardará y subirá al volver la conexión.
        </p>
      ) : null}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-estado-vencida/10 px-3 py-2 text-sm text-estado-vencida"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="min-h-touch w-full rounded-lg bg-zelanda-verde-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {pendiente ? "Registrando..." : "Registrar salida"}
      </button>
    </form>
  );
}
