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
/**
 * Datos de mentira para la vista previa.
 *
 * El admin escribe `{monto}` y no tiene forma de saber cómo va a leerse el
 * mensaje hasta que se lo manda a alguien. Con esto lo ve mientras escribe.
 */
export const EJEMPLO: DatosMensaje = {
  cliente: "María",
  monto: "$ 20.000,00",
  fecha: "10 ago 2026",
  dias: 5,
  plan: "Heladera Gafa",
};

/**
 * Comodines escritos que no existen.
 *
 * `aplicarPlantilla` los deja crudos a propósito —mejor que escribir
 * "undefined"—, pero crudos igual salen hacia el cliente. Esto los detecta
 * mientras se escribe la plantilla, que es cuando se pueden arreglar.
 */
export function comodinesDesconocidos(mensaje: string): string[] {
  const validos = new Set<string>(COMODINES.map((c) => c.clave));

  return [...mensaje.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .filter((clave) => !validos.has(clave))
    // Sin repetir: si escribió {clientee} tres veces, se avisa una.
    .filter((clave, i, todos) => todos.indexOf(clave) === i);
}

export function aplicarPlantilla(mensaje: string, datos: Partial<DatosMensaje>): string {
  return mensaje.replace(/\{(\w+)\}/g, (original, clave: string) => {
    const valor = datos[clave as keyof DatosMensaje];
    // `undefined` también se deja crudo: pasa cuando el botón no conoce ese
    // dato (el de un referente no sabe de qué cuota se habla). Escribir
    // "undefined" en el chat sería peor que dejar el comodín a la vista.
    return valor === undefined ? original : String(valor);
  });
}
