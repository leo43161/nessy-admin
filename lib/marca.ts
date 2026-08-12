/**
 * ════════════════════════════════════════════════════════════════════
 *  LA MARCA DE LA EMPRESA — es el único archivo que hay que tocar
 * ════════════════════════════════════════════════════════════════════
 *
 * Cambiá estas dos constantes y el nombre y el logo se actualizan en todos
 * lados: la barra del panel, el encabezado del PDF y el texto que se le manda
 * al cliente por WhatsApp.
 *
 * Este archivo está duplicado en las dos apps (`nessy` y `nessy-admin`), que
 * son dos deploys independientes. Cambialo en las dos.
 */

/** El nombre que ve el cliente. Va en el PDF y en los mensajes. */
export const EMPRESA_NOMBRE = "Nessy";

/**
 * El logo, como data URI.
 *
 * Tiene que ser data URI y no una ruta a un archivo porque el PDF se genera en
 * el navegador y se manda como adjunto: si fuera una URL, el logo no viajaría
 * con el archivo y el cliente vería un recuadro vacío.
 *
 * Para convertirlo: abrí el PNG en https://base64.guru/converter/encode/image
 * (o cualquier conversor) y pegá el resultado completo acá, incluido el
 * `data:image/png;base64,` del principio.
 *
 * Vacío = no se dibuja ningún logo y queda solo el nombre. Es lo que pasa hoy.
 */
export const EMPRESA_LOGO = "";

/** Pie de los documentos que ve el cliente */
export const EMPRESA_PIE = "Ante cualquier consulta, comunicate con tu cobrador asignado.";
