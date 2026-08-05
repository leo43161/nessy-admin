"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPeriodo } from "@/store/slices/admin.slice";
import { formatDayLabel, todayISO } from "@/lib/format";

/**
 * Cuotas del período seleccionado en la topbar.
 *
 * Operaciones y Cierre miran los mismos datos con distinta agregación, así
 * que comparten esta carga: al cambiar el rango se refresca una sola vez y
 * las dos pantallas lo leen del store.
 */
export function usePeriodo() {
  const dispatch = useAppDispatch();
  const rango = useAppSelector((s) => s.ui.rango);
  const { items, status, error } = useAppSelector((s) => s.admin.periodo);
  const cobradores = useAppSelector((s) => s.admin.cobradores.items);

  useEffect(() => {
    if (rango) dispatch(fetchPeriodo(rango));
  }, [rango, dispatch]);

  return {
    cobros: items,
    cobradores,
    rango,
    hoy: todayISO(),
    cargando: status === "idle" || status === "loading",
    error: status === "failed" ? error : null,
    /** "Lun 8 jun" o "Lun 8 jun → Sáb 13 jun" */
    etiquetaRango: rango
      ? rango.desde === rango.hasta
        ? formatDayLabel(rango.desde)
        : `${formatDayLabel(rango.desde)} → ${formatDayLabel(rango.hasta)}`
      : "",
  };
}
