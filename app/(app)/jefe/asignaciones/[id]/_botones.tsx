"use client";

import { useFormStatus } from "react-dom";

export function BotonSubmit({
  texto,
  textoPendiente,
  className,
}: {
  texto: string;
  textoPendiente: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? textoPendiente : texto}
    </button>
  );
}
