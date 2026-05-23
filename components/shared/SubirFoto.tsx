"use client";

import { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";

const MAX_LADO = 1280;
const CALIDAD_JPEG = 0.85;

async function comprimirImagen(file: File): Promise<File> {
  // Si ya es pequeña, no la tocamos
  if (file.size <= 200 * 1024) return file;

  const bitmap = await crearBitmap(file);
  const { width: w0, height: h0 } = bitmap;
  const mayor = Math.max(w0, h0);
  const escala = mayor > MAX_LADO ? MAX_LADO / mayor : 1;

  // Si no hay que escalar y el archivo no es enorme, devolvemos tal cual
  if (escala === 1 && file.size <= 500 * 1024) {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
    return file;
  }

  const w = Math.round(w0 * escala);
  const h = Math.round(h0 * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG),
  );
  if (!blob) return file;

  // Si la versión comprimida es más grande que la original, devolvemos la original
  if (blob.size >= file.size) return file;

  const nombre = renombrarAJpg(file.name);
  return new File([blob], nombre, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function crearBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through al fallback
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

function renombrarAJpg(nombre: string): string {
  const sinExt = nombre.replace(/\.[^.]+$/, "");
  return `${sinExt}.jpg`;
}

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubirFoto({ name }: { name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [tamano, setTamano] = useState<{
    original: number;
    final: number;
    comprimido: boolean;
  } | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      limpiar();
      return;
    }
    setError(null);
    setProcesando(true);

    try {
      const original = f;
      const comprimida = await comprimirImagen(original);

      // Reemplazar el FileList del input con la versión comprimida
      if (inputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(comprimida);
        inputRef.current.files = dt.files;
      }

      setNombreArchivo(comprimida.name);
      setTamano({
        original: original.size,
        final: comprimida.size,
        comprimido: comprimida !== original,
      });

      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(comprimida);
    } catch (err) {
      console.warn("Error procesando imagen:", err);
      setError("No se pudo procesar la imagen. Probá con otra.");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setProcesando(false);
    }
  }

  function limpiar() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setNombreArchivo(null);
    setTamano(null);
    setError(null);
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
            className="max-h-64 w-full rounded-[10px] border border-zelanda-beige-300 object-cover"
          />
          <button
            type="button"
            onClick={limpiar}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-zelanda-verde-900/80 text-zelanda-beige-50 shadow-lg hover:bg-zelanda-verde-900"
            aria-label="Quitar foto"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-zelanda-verde-700">
            <span className="truncate">{nombreArchivo}</span>
            {tamano ? (
              <span className="whitespace-nowrap">
                {tamano.comprimido ? (
                  <>
                    {tamanoLegible(tamano.original)} →{" "}
                    <strong className="text-zelanda-verde-900">
                      {tamanoLegible(tamano.final)}
                    </strong>
                  </>
                ) : (
                  tamanoLegible(tamano.final)
                )}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <label
          htmlFor={`input-${name}`}
          className={`flex min-h-touch w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-zelanda-beige-300 bg-zelanda-beige-50 px-4 py-6 text-sm text-zelanda-verde-700 transition hover:border-zelanda-verde-300 hover:bg-zelanda-beige-100 ${procesando ? "pointer-events-none opacity-60" : ""}`}
        >
          {procesando ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Procesando…
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" />
              Tomar foto o elegir archivo
            </>
          )}
        </label>
      )}
      {error ? (
        <p className="text-[11.5px] text-estado-vencida">{error}</p>
      ) : null}
      {tamano?.comprimido ? (
        <p className="text-[10.5px] text-zelanda-verde-700/70">
          Reescalada automáticamente a {MAX_LADO} px de lado mayor para subir
          rápido en señal débil.
        </p>
      ) : null}
    </div>
  );
}
