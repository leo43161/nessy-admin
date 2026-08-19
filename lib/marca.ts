/**
 * ════════════════════════════════════════════════════════════════════
 *  LA MARCA DE LA EMPRESA — es el único archivo que hay que tocar
 * ════════════════════════════════════════════════════════════════════
 *
 * Cambiá lo de acá y el nombre, el logo y los colores se actualizan en todos
 * lados: la barra del panel, el encabezado del PDF y el texto que se le manda
 * al cliente por WhatsApp.
 *
 * Este archivo está duplicado en las dos apps (`nessy` y `nessy-admin`), que
 * son dos deploys independientes. Cambialo en las dos.
 *
 * Los colores de la interfaz web viven en `app/globals.css` (Tailwind los
 * necesita como custom properties en tiempo de build, no puede leerlos de un
 * módulo TS). Los de acá son para lo que se genera en runtime —el PDF— y para
 * el isotipo. **Si cambiás la paleta, cambiá los dos.**
 */

/** El nombre que ve el cliente. Va en el PDF y en los mensajes. */
export const EMPRESA_NOMBRE = "Preferenciale";

/**
 * Paleta de marca. Sale del brand sheet de Preferenciale
 * (`img/Brand Identity/Preferenciale Brand Sheet.html`).
 */
export const MARCA_COLORES = {
  /** Deep Navy Blue — títulos, isotipo, texto fuerte */
  primario: "#0E1E3A",
  /** Slate Gray — texto secundario, etiquetas */
  secundario: "#5C6B7A",
  /** Emerald Green — acento: la hoja del isotipo, los totales al día */
  acento: "#0E9C6B",
  /** Emerald oscuro — hover, bordes del acento */
  acentoOscuro: "#0B7A54",
  /** Bordes y reglas */
  borde: "#D6DAE0",
  /** Fondo de bloques tenues */
  fondo: "#EDEEF0",
  /** Gris apagado para lo poco importante */
  tenue: "#9AA4AE",
  /** Rojo de alarma: atrasos y advertencias. Va de fondo, con letra blanca. */
  alarma: "#B3261E",
  /** Lo que se escribe encima del primario o de la alarma */
  sobreOscuro: "#FFFFFF",
} as const;

/**
 * El isotipo, como geometría en vez de imagen.
 *
 * El PNG de marca son 2448×1432 (170 KB en base64) y en el PDF se dibuja a
 * 30 pt: inflar el bundle con eso para tirar el 99% de los píxeles no tiene
 * sentido. Como son cuatro primitivas —un cuadrado redondeado y una hoja—,
 * se dibujan con `<svg>` en la web y con `<Svg>` de @react-pdf en el PDF, con
 * este mismo path. Sale nítido en cualquier tamaño y no pesa nada.
 */
export const MARCA_ISOTIPO = {
  /** Lienzo cuadrado del isotipo completo */
  viewBox: "0 0 240 240",
  /** Radio de las esquinas del cuadrado (22.5% del lado, como el original) */
  radio: 54,
  /**
   * Dónde va la hoja adentro del cuadrado, en las mismas unidades del
   * `viewBox`. Son los márgenes del logo original.
   */
  hoja: { x: 50, y: 34, ancho: 140, alto: 172 },
  /**
   * Recorte ajustado al path. El `d` de abajo se dibuja en su propio sistema
   * de coordenadas —arranca cerca del origen y llega a ~229×281—, así que en
   * vez de escalarlo con un `transform` se lo mete en un lienzo propio con
   * este viewBox y el renderer hace la cuenta. Con `transform` no alcanzaba:
   * @react-pdf aplica las transformaciones respecto del origen del propio
   * nodo, no del lienzo, así que el mismo string daba distinto en la web y en
   * el PDF.
   */
  hojaViewBox: "-3 -3 238 288",
  path:
    "M50.45,280.93,58,280.7c12.56-.38,25.54-1.76,38.09-.95,7.18.53,14.41,1.12,21.6,1.29," +
    "7.69.27,15.28-.6,22.93-.6h0c8.28-.82,21.34-1.63,27.17-8.43s-.68-13.25-2.57-20.25c-1.25-4.63-2.27-9.32-3.19-14a913.2," +
    "913.2,0,0,1-13.14-98.43c-1.66-20.59-5.11-43.12,2.91-62.85,6.31-15.51,17.51-29,29.43-40.63a4.7,4.7,0,0,1,4.93-1c13.08," +
    "5,28.57,5.18,38.42,4.62a4.63,4.63,0,0,0,3-7.9L201.94,5.9a17,17,0,0,0-8.44-4.64c-15.3-3.24-30.19,4.3-41.75,14.4-32.23," +
    "28.19-50.27,73-55.21,114.74-2.45,20.74-1.71,41.83-5.61,62.34-.44,2.32-.94,4.62-1.53,6.91-5.2,20.47-15.09,48.26-37.89," +
    "54.79-5,1.44-10.34,1.5-15.49,2.33-4.8.77-9.24,2.66-13.73,4.46-7.22,2.9-13.33,7.22-19.73,11.58a4.76,4.76,0,0,0-1.77,2c-2.88," +
    "6.68,16.79,6.19,19.59,6.28C30.41,281.42,40.43,281.22,50.45,280.93Z",
} as const;

/**
 * Logo alternativo, como data URI.
 *
 * Si lo cargás, gana sobre el isotipo dibujado. Tiene que ser data URI y no
 * una ruta a un archivo porque el PDF se genera en el navegador y se manda
 * como adjunto: si fuera una URL, el logo no viajaría con el archivo y el
 * cliente vería un recuadro vacío.
 *
 * Vacío = se dibuja `MARCA_ISOTIPO`, que es lo que conviene salvo que la
 * marca tenga algo que no se pueda hacer con vectores simples.
 */
export const EMPRESA_LOGO = "";

/** Pie de los documentos que ve el cliente */
export const EMPRESA_PIE = "Ante cualquier consulta, comunicate con tu cobrador asignado.";
