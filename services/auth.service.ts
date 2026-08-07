import { api } from "@/services/api";
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

/**
 * Login del panel admin.
 *
 * Solo entran cuentas con rol admin: un cobrador tiene su propia app y acá
 * no tendría nada que hacer. La API valida lo mismo del lado del servidor
 * (Middleware::exigirRol), esto es la puerta de calle, no la cerradura.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
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

/**
 * ¿La sesión sigue viva? Lo decide la API, no el front.
 *
 * No recibe el token: lo pone el interceptor desde localStorage. Pasarlo por
 * parámetro sugería que viajaba en el body, y no es así.
 */
export async function validateToken(): Promise<boolean> {
  try {
    // No existe /auth/validate: la sesión se comprueba pidiendo /auth/yo, que
    // el middleware ya protege con el token del header.
    await api.get("/auth/yo");
    return true;
  } catch {
    return false;
  }
}
