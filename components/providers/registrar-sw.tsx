"use client";

import { useEffect } from "react";

/**
 * Registra el service worker que hace instalable el panel.
 *
 * No dibuja nada: es solo el enganche. Va en el layout para que corra una vez
 * por sesión, sin importar por qué pantalla se entró.
 *
 * ⚠️ La ruta y el alcance llevan el `basePath` a mano. El panel se sirve desde
 * una subcarpeta y **el alcance de un service worker no puede subir de su
 * propia carpeta**: registrarlo en la raíz del dominio directamente falla, y
 * registrarlo bien pero con `scope: "/"` también. Los dos tienen que apuntar a
 * la subcarpeta.
 *
 * Si algo sale mal se ignora en silencio a propósito: sin service worker el
 * panel anda igual, solo se pierde el cartel de instalar. No vale la pena
 * molestar a nadie con un error por eso.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
  }, []);

  return null;
}
