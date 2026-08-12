import { whatsappUrl } from "@/lib/format";

/**
 * Envío del estado de cuenta por WhatsApp.
 *
 * Un link `wa.me` **no puede adjuntar archivos**: abre el chat con el texto y
 * nada más. La única forma de que el PDF llegue adjunto desde el navegador es
 * `navigator.share()` con el archivo, que abre la hoja de compartir del
 * sistema; ahí el usuario elige WhatsApp y el contacto.
 *
 * Esa API existe en Android/iOS pero no en escritorio, así que hay dos
 * caminos y el destinatario solo se puede elegir en el segundo.
 */

/** ¿Puede el navegador compartir archivos? (celular sí, escritorio no) */
export function puedeCompartirArchivos(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  // canShare necesita un archivo de muestra; uno vacío alcanza para preguntar.
  const muestra = new File([], "estado-cuenta.pdf", { type: "application/pdf" });
  try {
    return navigator.canShare({ files: [muestra] });
  } catch {
    return false;
  }
}

/**
 * Manda el estado de cuenta y devuelve si el envío llegó a salir.
 *
 * `false` solo cuando el usuario cierra la hoja de compartir sin elegir nada:
 * ahí no se mandó, y el diálogo obligatorio no debe darse por cumplido.
 */
export async function enviarEstadoCuenta(
  archivo: File,
  texto: string,
  numero: string | null,
  descargar: (archivo: File) => void
): Promise<boolean> {
  if (puedeCompartirArchivos()) {
    try {
      await navigator.share({ files: [archivo], text: texto });
      return true;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return false;
      // Cualquier otro fallo (permisos, share no soportado en ese contexto):
      // sigue por el camino de escritorio en vez de dejar al cobrador trabado.
    }
  }

  // Escritorio: el PDF va por descarga y el texto por el chat. Son dos cosas
  // separadas porque el navegador no puede meter el archivo en el chat.
  descargar(archivo);
  if (numero) window.open(whatsappUrl(numero, texto), "_blank");
  return true;
}
