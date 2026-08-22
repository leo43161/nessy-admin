import type { MetadataRoute } from "next";

/**
 * El manifiesto que hace instalable el panel.
 *
 * Con esto el navegador ofrece "Agregar a la pantalla de inicio" y la app
 * queda como un icono más del celular: se abre sin barra de direcciones y con
 * su propio nombre. No cambia nada de cómo funciona — es la misma web.
 *
 * ⚠️ **Las rutas llevan el `basePath` a mano.** El panel se sirve desde una
 * subcarpeta del dominio y el manifiesto es un JSON suelto: no pasa por el
 * router de Next, que es quien normalmente lo agrega. Sin esto, `start_url`
 * apunta a la raíz del dominio —que es otro proyecto— y el icono instalado
 * abre la app equivocada.
 *
 * `dynamic = "force-static"` porque el sitio es un export estático: sin eso
 * Next intenta resolver esta ruta en tiempo de pedido y no hay servidor.
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return {
    name: "Preferenciale — Panel de Cobranzas",
    // El que se ve debajo del icono: entran unos 12 caracteres.
    short_name: "Preferenciale",
    description: "Supervisión de cobranzas y gestión de clientes y financiaciones",
    // Arranca en el tablero y no en la raíz: la raíz solo redirige, y en una
    // app instalada ese salto se ve como un parpadeo al abrir.
    start_url: `${base}/operaciones/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    lang: "es-AR",
    dir: "ltr",
    // El navy de marca: es lo que pinta la barra de estado y la pantalla
    // mientras carga, así que abrir la app no muestra un flash blanco.
    background_color: "#0E1E3A",
    theme_color: "#0E1E3A",
    icons: [
      { src: `${base}/icons/icono-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icono-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable: Android recorta el icono con la forma del launcher y solo
      // garantiza el 80% central. Este trae el fondo a sangre y el isotipo
      // más chico, para que ningún recorte se lo coma.
      {
        src: `${base}/icons/icono-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
