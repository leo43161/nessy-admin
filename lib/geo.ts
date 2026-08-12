/**
 * Ubicación del cobro.
 *
 * Los tres SP de cobro reciben `lat`/`lon`, los comparan con
 * `Clientes.ubicacion_geografica_de_destino_de_cobro` con ST_Distance_Sphere y
 * marcan `Dentro_Rango = 1` si el cobro se hizo a ≤ 2 km del punto de cobro.
 *
 * El panel también la pide: se usa desde el celular, así que un cobro cargado
 * ahí puede estar perfectamente en el domicilio del cliente. Cargado desde una
 * computadora en la oficina va a dar fuera de rango, y está bien que así sea.
 *
 * **Nunca bloquea el cobro.** Sin permiso, sin GPS o con timeout se manda en
 * null y la cuota queda con `Dentro_Rango = 0`.
 */

export interface Ubicacion {
  lat: number;
  lon: number;
}

const TIMEOUT_MS = 8000;

export async function obtenerUbicacion(): Promise<Ubicacion | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 60_000 },
    );
  });
}
