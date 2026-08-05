import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "@/lib/constants";

/**
 * Guard optimista de rutas: sin cookie de token no se entra a la app.
 * La validación real del JWT la hace la API en cada request (401 → login).
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;
  const enLogin = pathname === "/login";

  if (!token && !enLogin) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  if (token && enLogin) {
    return NextResponse.redirect(new URL("/operaciones", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Todo menos assets estáticos y archivos con extensión
  matcher: ["/((?!_next|favicon\\.ico|.*\\..*).*)"],
};
