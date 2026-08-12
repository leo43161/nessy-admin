/**
 * El punto de cobro del cliente.
 *
 * `Clientes.ubicacion_geografica_de_destino_de_cobro` es un `varchar` que
 * guarda `"lat,lon"`. No es decorativo: los tres SPs de cobro leen esa columna
 * con `SUBSTRING_INDEX` + `CAST(... AS DECIMAL)` y la comparan contra el lugar
 * desde donde el cobrador registró el cobro (`ST_Distance_Sphere`) para marcar
 * `Dentro_Rango` si estuvo a ≤ 2 km.
 *
 * Si en esa columna hay cualquier otra cosa —texto libre, por ejemplo— el SP
 * no encuentra coordenadas y el control de rango de ese cliente queda apagado
 * en silencio. Por eso el formulario guarda solo lo que `parsearPunto` acepta.
 */
export interface Punto {
  lat: number;
  lon: number;
}

/** "lat,lon" → punto, o null si no son coordenadas válidas */
export function parsearPunto(valor: string | null | undefined): Punto | null {
  const partes = valor?.split(",");
  if (partes?.length !== 2) return null;

  const lat = Number(partes[0].trim());
  const lon = Number(partes[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return { lat, lon };
}

/**
 * Punto → "lat,lon" para guardar.
 *
 * Seis decimales (≈ 11 cm) y sin espacios: la columna del SP es
 * `DECIMAL(10,8)` / `DECIMAL(11,8)`, así que más decimales se pierden igual y
 * un espacio de más es basura que el CAST tiene que adivinar.
 */
export function formatearPunto(p: Punto): string {
  return `${redondear(p.lat)},${redondear(p.lon)}`;
}

function redondear(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
