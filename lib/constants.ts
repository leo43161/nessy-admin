export const APP_NAME = "NessyAdmin";

// Claves de almacenamiento local. Llevan prefijo `na_` (no `gc_`) para que la
// app del cobrador y la del admin puedan convivir en el mismo navegador
// sin pisarse la sesión ni el mock.
export const TOKEN_KEY = "na_token";
export const USER_KEY = "na_user";
export const RANGO_KEY = "na_rango";
export const MOCK_DB_KEY = "na_mock_db_v1";

/** Nombre de la cookie que lee proxy.ts para proteger rutas */
export const TOKEN_COOKIE = "na_token";

/** Un color por cobrador, en el orden en que vienen de la API */
export const COBRADOR_COLORS = [
  "var(--cobrador-1)",
  "var(--cobrador-2)",
  "var(--cobrador-3)",
] as const;

export function colorCobrador(indice: number): string {
  return COBRADOR_COLORS[indice % COBRADOR_COLORS.length];
}
