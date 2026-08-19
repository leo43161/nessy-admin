/**
 * Cómo se llama esta app PARA ADENTRO. Lo que ve el cliente sale de
 * `lib/marca.ts` (EMPRESA_NOMBRE): esto es solo para distinguir las dos apps
 * en textos internos, como el aria-label de cerrar sesión.
 */
export const APP_NAME = "Panel admin";

// Claves de almacenamiento local. Llevan prefijo `na_` (no `gc_`) para que la
// app del cobrador y la del admin puedan convivir en el mismo navegador
// sin pisarse la sesión.
export const TOKEN_KEY = "na_token";
export const USER_KEY = "na_user";
export const RANGO_KEY = "na_rango";

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

/**
 * San Miguel de Tucumán en `Localidades_y_regiones`.
 *
 * Es la localidad de casi toda la cartera, así que las fichas nuevas nacen
 * con ella elegida en vez de con el select vacío. Está fijo y no se busca por
 * nombre porque el id de una semilla no cambia, y buscar por texto haría que
 * un acento distinto en la base dejara el default en blanco sin avisar.
 */
export const LOCALIDAD_POR_DEFECTO = 1;

/**
 * Cada cuánto se refresca solo el tablero de operaciones.
 *
 * Diez segundos es lo que pidió el cliente y es razonable: son dos requests
 * (`/cuotas` y el contexto) sobre una cartera chica. Si la cartera crece,
 * subirlo antes que sacarlo — el valor de ese tablero es estar al día.
 */
export const AUTO_REFRESCO_SEGUNDOS = 10;
