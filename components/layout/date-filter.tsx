"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/format";
import { PRESETS, periodoDeRango, rangoDePeriodo, type PeriodoId } from "@/lib/periodos";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setDesde, setHasta, setRango } from "@/store/slices/ui.slice";

/**
 * Filtro de fecha global de la supervisión.
 *
 * Los períodos de siempre están a un toque —hoy, esta semana, el mes pasado,
 * los últimos 3 meses, el año— y las dos fechas sueltas quedan para cuando
 * ninguno alcanza. El chip marcado se deduce del rango, así que al recargar
 * la página vuelve a quedar donde estaba sin guardar nada aparte.
 *
 * Los inputs son `<input type="date">` nativos: el calendario del sistema es
 * mejor en móvil que cualquier date picker propio.
 */
export function DateFilter() {
  const dispatch = useAppDispatch();
  const { rango } = useAppSelector((s) => s.ui);
  if (!rango) return null;

  const hoy = todayISO();
  const activo = periodoDeRango(rango, hoy);

  const elegir = (id: PeriodoId) => {
    // "Rango" no cambia las fechas: solo abre los dos inputs para editarlas.
    if (id === "personalizado") return;
    dispatch(setRango(rangoDePeriodo(id, hoy)));
  };

  return (
    <div className="space-y-2 px-4 pb-3">
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => elegir(p.id)}
            aria-pressed={activo === p.id}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              activo === p.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label="Fecha desde"
          value={rango.desde}
          onChange={(e) => dispatch(setDesde(e.target.value))}
          className="h-8 flex-1 bg-secondary text-xs font-medium"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          aria-label="Fecha hasta"
          min={rango.desde}
          value={rango.hasta}
          onChange={(e) => dispatch(setHasta(e.target.value))}
          className="h-8 flex-1 bg-secondary text-xs font-medium"
        />
      </div>
    </div>
  );
}
