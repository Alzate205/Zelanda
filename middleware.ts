import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { RUTA_INICIO_POR_ROL } from "@/lib/constantes";
import type { RolUsuario } from "@/types";

const RUTAS_PROTEGIDAS = ["/jefe", "/bodega", "/almacen", "/trabajador"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca el token si está por vencer.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaProtegida = RUTAS_PROTEGIDAS.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );

  // Sin sesión en ruta protegida: a /login conservando destino original.
  if (esRutaProtegida && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirigir", pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión en /login o /: a la home del rol.
  if (user && (pathname === "/login" || pathname === "/")) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .single();
    const rol = usuario?.rol as RolUsuario | undefined;
    if (rol) {
      const url = request.nextUrl.clone();
      url.pathname = RUTA_INICIO_POR_ROL[rol];
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto archivos estáticos, imágenes,
     * y assets de Next.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
