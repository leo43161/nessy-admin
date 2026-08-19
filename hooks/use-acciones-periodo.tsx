"use client";

import { CalendarRange } from "lucide-react";
import type { AccionPantalla } from "@/components/shared/acciones-fab";
import { PRESETS, periodoDeRango, rangoDePeriodo } from "@/lib/periodos";
import { todayISO } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setRango } from "@/store/slices/ui.slice";

/** Qué abarca cada período, en criollo. */
const DESCRIPCION: Record<string, string> = {
  hoy: "Solo el día de hoy",
  semana: "De lunes a domingo",
  mes: "Del 1 hasta fin de mes",
  mesPasado: "El mes anterior completo",
  tresMeses: "Los últimos tres meses",
  anio: "Desde el 1 de enero",
};

/**
 * Los períodos del filtro de la topbar, como acciones del botón de opciones.
 *
 * Las tres pantallas de supervisión —operaciones, cierre y análisis— miran el
 * mismo rango, así que comparten estas acciones en vez de repetir la lista de
 * presets en cada una.
 *
 * "Rango" (el personalizado) queda afuera a propósito: necesita dos fechas y
 * eso son dos campos, no un ítem de menú. Sigue estando en la topbar.
 */
export function useAccionesDePeriodo(): AccionPantalla[] {
  const dispatch = useAppDispatch();
  const rango = useAppSelector((s) => s.ui.rango);
  const hoy = todayISO();
  const activo = rango ? periodoDeRango(rango, hoy) : null;

  return PRESETS.filter((p) => p.id !== "personalizado").map((preset) => ({
    label: "Ver " + preset.label.toLowerCase(),
    descripcion: DESCRIPCION[preset.id],
    icon: <CalendarRange />,
    onSelect: () => dispatch(setRango(rangoDePeriodo(preset.id, hoy))),
    disabled: activo === preset.id,
  }));
}
