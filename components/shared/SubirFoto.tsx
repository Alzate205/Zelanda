"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";

export function SubirFoto({ name }: { name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  function alSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPreview(null);
      setNombreArchivo(null);
      return;
    }
    setNombreArchivo(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  function limpiar() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setNombreArchivo(null);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={alSeleccionar}
        className="sr-only"
        id={`input-${name}`}
      />
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Vista previa"
            className="max-h-64 w-full rounded-lg border border-zelanda-beige-300 object-cover"
          />
          <button
            type="button"
            onClick={limpiar}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-zelanda-verde-900/80 text-zelanda-beige-50 shadow-lg"
            aria-label="Quitar foto"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="mt-1.5 truncate text-xs text-zelanda-verde-700">
            {nombreArchivo}
          </p>
        </div>
      ) : (
        <label
          htmlFor={`input-${name}`}
          className="flex min-h-touch w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zelanda-beige-300 bg-zelanda-beige-50 px-4 py-6 text-sm text-zelanda-verde-700 transition hover:border-zelanda-verde-300 hover:bg-zelanda-beige-100"
        >
          <Camera className="h-5 w-5" />
          Tomar foto o elegir archivo
        </label>
      )}
    </div>
  );
}
