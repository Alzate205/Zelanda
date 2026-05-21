import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { construirSnapshotJefe } from "@/lib/jefe/snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "JEFE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const snapshot = await construirSnapshotJefe();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
