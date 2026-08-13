/**
 * Los comodines de las plantillas de mensaje.
 *
 * Vive en `lib/` y no en el servicio para que no arrastre axios: así el chequeo
 * puede importarlo con node a secas.
 */

export interface DatosMensaje {
  cliente: string;
  monto: string;
  fecha: string;
  dias: number;
  plan: string;
}

/** Lo que el admin puede escribir entre llaves, con su explicación */
export const COMODINES: { clave: keyof DatosMensaje; ejemplo: string }[] = [
  { clave: "cliente", ejemplo: "nombre del cliente" },
  { clave: "monto", ejemplo: "importe de la cuota" },
  { clave: "fecha", ejemplo: "vencimiento" },
  { clave: "dias", ejemplo: "días de atraso" },
  { clave: "plan", ejemplo: "nombre del plan" },
];

/**
 * Reemplaza `{cliente}`, `{monto}`, … con los datos reales.
 *
 * Un comodín mal escrito se deja tal cual en vez de borrarse: si el mensaje
 * sale con `{clientee}` a la vista, se ve el error y se corrige la plantilla.
 * Vaciarlo lo escondería y el cliente recibiría una frase sin sujeto.
 */
export function aplicarPlantilla(mensaje: string, datos: Partial<DatosMensaje>): string {
  return mensaje.replace(/\{(\w+)\}/g, (original, clave: string) => {
    const valor = datos[clave as keyof DatosMensaje];
    // `undefined` también se deja crudo: pasa cuando el botón no conoce ese
    // dato (el de un referente no sabe de qué cuota se habla). Escribir
    // "undefined" en el chat sería peor que dejar el comodín a la vista.
    return valor === undefined ? original : String(valor);
  });
}
