"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Vuelve a pedir los datos cada `segundos`, y devuelve cuántos faltan.
 *
 * El tablero de operaciones es lo que el admin deja abierto mientras los
 * cobradores están en la calle: sin esto había que acordarse de apretar
 * "Actualizar" para enterarse de un cobro.
 *
 * La cuenta regresiva se muestra a propósito. Un tablero que se refresca solo
 * y no lo dice hace dudar de si lo que se está mirando es de ahora o de hace
 * media hora; con el número al lado, se sabe.
 *
 * Dos cosas que hace y conviene no perder:
 *
 *  · Se pausa con la pestaña en segundo plano (`visibilitychange`). Una
 *    pestaña olvidada durante el fin de semana son ~30.000 requests al
 *    hosting compartido por nada.
 *  · El callback vive en un ref, así que el intervalo no se recrea en cada
 *    render aunque `onRefrescar` sea una función nueva cada vez.
 */
export function useAutoRefresco(onRefrescar: () => void, segundos: number): number {
  const [restante, setRestante] = useState(segundos);
  const callback = useRef(onRefrescar);

  // En un efecto y no en el render: escribir un ref mientras se renderiza
  // rompe con Strict Mode y lo marca react-hooks/refs.
  useEffect(() => {
    callback.current = onRefrescar;
  }, [onRefrescar]);

  useEffect(() => {
    const tick = () =>
      setRestante((n) => {
        if (document.visibilityState !== "visible") return segundos;
        if (n > 1) return n - 1;
        callback.current();
        return segundos;
      });

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [segundos]);

  return restante;
}
