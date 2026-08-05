import { api, USE_MOCK } from "@/services/api";
import { delay, getDb } from "@/services/mock/db";
import { isTokenExpired } from "@/lib/session";
import type { LoginPayload, LoginResponse } from "@/types";

/** Roles.id_Roles del admin — espeja ROL_ADMIN de config/config.php en la API */
export const ROL_ADMIN = 1;

/** Lo que la API mete en `data` del JWT y devuelve en /auth/login y /auth/yo */
interface DatosToken {
  user_id: number;
  usuario: string;
  rol_id: number;
  rol: string;
  id_Cobrador: number | null;
}

/** JWT de utilería para el mock (la API real firma el suyo) */
function buildMockJwt(sub: number, name: string, rolId: number): string {
  const b64 = (obj: object) => btoa(JSON.stringify(obj)).replace(/=+$/, "");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub,
    name,
    rol_id: rolId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  });
  return `${header}.${payload}.mock-signature`;
}

/**
 * Login del panel admin.
 *
 * Solo entran cuentas con rol admin: un cobrador tiene su propia app y acá
 * no tendría nada que hacer. La API valida lo mismo del lado del servidor
 * (Middleware::exigirRol), esto es la puerta de calle, no la cerradura.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  if (USE_MOCK) {
    const db = getDb();
    const cuentaRow = db.cuentas.find(
      (c) => c.nombreDeUsuario.toLowerCase() === payload.usuario.trim().toLowerCase(),
    );
    if (!cuentaRow || !payload.password) {
      await delay(null, 500);
      throw new Error("Usuario o contraseña incorrectos.");
    }
    if (cuentaRow.rolId !== ROL_ADMIN) {
      await delay(null, 500);
      throw new Error("Esta cuenta no tiene acceso al panel de administración.");
    }
    return delay(
      {
        token: buildMockJwt(cuentaRow.id, cuentaRow.nombreDeUsuario, cuentaRow.rolId),
        cuenta: {
          id: cuentaRow.id,
          nombreDeUsuario: cuentaRow.nombreDeUsuario,
          rol: cuentaRow.rol,
          rolId: cuentaRow.rolId,
        },
        cobrador: cuentaRow.idCobrador
          ? (db.cobradores.find((c) => c.id === cuentaRow.idCobrador) ?? null)
          : null,
      },
      500,
    );
  }
  // La API devuelve { token, expira_el, usuario: {...} } con las claves del
  // token, no el { token, cuenta, cobrador } que arma el front.
  const { data } = await api.post<{ token: string; usuario: DatosToken }>("/auth/login", payload);

  if (data.usuario.rol_id !== ROL_ADMIN) {
    throw new Error("Esta cuenta no tiene acceso al panel de administración.");
  }

  return {
    token: data.token,
    cuenta: {
      id: data.usuario.user_id,
      nombreDeUsuario: data.usuario.usuario,
      rol: data.usuario.rol,
      rolId: data.usuario.rol_id,
    },
    // El admin nunca está ligado a un cobrador (id_Cobrador viene null), así
    // que en este panel no hace falta ir a buscar la persona.
    cobrador: null,
  };
}

/** Valida el token contra la API (mock: chequeo local de expiración) */
export async function validateToken(token: string): Promise<boolean> {
  if (USE_MOCK) {
    return delay(!isTokenExpired(token), 100);
  }
  try {
    // No existe /auth/validate: la sesión se comprueba pidiendo /auth/yo, que
    // el middleware ya protege con el token del header.
    await api.get("/auth/yo");
    return true;
  } catch {
    return false;
  }
}
