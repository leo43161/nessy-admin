"use client";

import { useEffect, useState } from "react";
import { getLocalidades } from "@/services/cobradores.service";
import type { Localidad } from "@/types";

// Catálogo estable durante la sesión: se pide una vez y se comparte.
// Los cobradores no van acá — los carga el layout al store, porque los
// tres tabs de supervisión dependen de su orden para asignar colores.
let localidadesCache: Localidad[] | null = null;

export function useLocalidades(): Localidad[] {
  const [localidades, setLocalidades] = useState<Localidad[]>(localidadesCache ?? []);

  useEffect(() => {
    if (localidadesCache) return;
    let activo = true;
    getLocalidades().then((data) => {
      localidadesCache = data;
      if (activo) setLocalidades(data);
    });
    return () => {
      activo = false;
    };
  }, []);

  return localidades;
}
