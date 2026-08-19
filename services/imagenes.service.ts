import { api } from "@/services/api";

/**
 * Subida de la foto de un cliente.
 *
 * La API guarda el archivo y devuelve **dónde quedó**, no el archivo:
 * `Clientes.img` es un varchar(255). Esa ruta viene relativa a la carpeta de
 * la API ("uploads/clientes/ab12….jpg") para que siga sirviendo si mañana
 * cambia el dominio; `urlDeImagen()` la vuelve absoluta para mostrarla.
 */
export interface ImagenSubida {
  ruta: string;
  ancho: number;
  alto: number;
  bytes: number;
}

export async function subirImagen(archivo: File): Promise<ImagenSubida> {
  const cuerpo = new FormData();
  cuerpo.append("archivo", archivo);

  // Sin `Content-Type` a mano: el navegador tiene que ponerlo él, porque
  // multipart necesita un `boundary` que solo él conoce. Escribirlo pisa el
  // que corresponde y PHP recibe `$_FILES` vacío.
  const { data } = await api.post<ImagenSubida>("/imagenes/subir", cuerpo, {
    headers: { "Content-Type": undefined },
  });

  return data;
}

/**
 * La ruta guardada → una URL que el navegador pueda pedir.
 *
 * Tolera que en la base haya una URL completa: las fichas viejas podían tener
 * un link pegado a mano, y esas tienen que seguir mostrándose.
 */
export function urlDeImagen(ruta: string | null): string | null {
  if (!ruta) return null;
  if (/^https?:\/\//i.test(ruta) || ruta.startsWith("data:")) return ruta;

  return `${process.env.NEXT_PUBLIC_API_URL}/${ruta.replace(/^\/+/, "")}`;
}
