/*
 * Service worker del panel.
 *
 * Hace dos cosas y nada más:
 *
 *   1. Que el navegador ofrezca instalar la app. Sin un service worker con
 *      manejador de `fetch`, varios navegadores no muestran el cartel de
 *      "Agregar a la pantalla de inicio" por más que el manifiesto esté bien.
 *
 *   2. Que sin señal aparezca un cartel entendible en vez del error del
 *      navegador. Esto se usa desde el celular, y en el interior la señal se
 *      corta.
 *
 * ⚠️ **A propósito NO cachea la aplicación.** La tentación es guardar el JS y
 * el HTML para que abra rápido y ande offline, y ahí empieza el problema
 * clásico de las PWA: después de un deploy el cliente sigue viendo la versión
 * vieja durante días, sin ninguna señal de que está desactualizado, y llamando
 * por bugs que ya se arreglaron. Para un panel que escribe plata en una base
 * eso es peor que no tener PWA. Así que todo va siempre a la red, y lo único
 * que se guarda es el cartel de "sin conexión".
 *
 * Si algún día se quiere de verdad offline, el camino no es cachear a mano:
 * es versionar el cache con el hash del build e invalidarlo en cada deploy.
 */

const CACHE = "panel-offline-v1";

/**
 * La clave del cartel, absoluta.
 *
 * El Cache API resuelve las claves como URLs relativas a quien pregunta, y
 * acá preguntan dos contextos distintos —el service worker y la página—, cada
 * uno parado en otra carpeta. Con una clave relativa, guardar y buscar caen
 * en URLs distintas.
 */
const CLAVE = new URL("sin-conexion", self.registration.scope).href;

/** Lo que se ve cuando no hay señal. Es lo único que se guarda. */
const SIN_CONEXION = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sin conexión</title>
<style>
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
         background:#0E1E3A; color:#fff; font-family:system-ui,sans-serif; text-align:center; padding:24px }
  h1 { font-size:1.25rem; margin:0 0 .5rem }
  p  { color:#9AA4AE; margin:0 0 1.5rem; line-height:1.5 }
  button { font:inherit; font-weight:700; background:#0E9C6B; color:#0E1E3A; border:0;
           border-radius:.75rem; padding:.85rem 1.5rem; min-height:44px }
</style></head>
<body><div>
  <h1>Te quedaste sin conexión</h1>
  <p>No se pudo cargar la página.<br>Fijate que tengas datos o wifi y volvé a intentar.</p>
  <button onclick="location.reload()">Reintentar</button>
</div></body></html>`;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.put(
          CLAVE,
          new Response(SIN_CONEXION, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
        ),
      )
      // Sin esto el service worker nuevo espera a que se cierren todas las
      // pestañas viejas, y un arreglo puede tardar días en llegar.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  // Solo las navegaciones. Todo lo demás —JS, imágenes, y sobre todo las
  // llamadas a la API— va derecho a la red, sin pasar por acá.
  if (evento.request.mode !== "navigate") return;

  evento.respondWith(
    fetch(evento.request).catch(async () => {
      const guardado = await caches.match(CLAVE);
      return (
        guardado ??
        new Response(SIN_CONEXION, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      );
    }),
  );
});
