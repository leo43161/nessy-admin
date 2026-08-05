"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setDesde, setHasta, setModo, type ModoFecha } from "@/store/slices/ui.slice";

const OPCIONES: Array<{ valor: ModoFecha; label: string }> = [
  { valor: "dia", label: "Día" },
  { valor: "rango", label: "Rango" },
];

/**
 * Filtro de fecha global de la supervisión: un día suelto o un rango.
 * Usa `<input type="date">` nativo — el calendario del sistema operativo
 * es mejor en móvil que cualquier date picker que pudiéramos armar.
 */
export function DateFilter() {
  const dispatch = useAppDispatch();
  const { modo, rango } = useAppSelector((s) => s.ui);
  if (!rango) return null;

  return (
    <div className="space-y-2 px-4 pb-3">
      <div className="flex gap-2">
        {OPCIONES.map((op) => (
          <button
            key={op.valor}
            onClick={() => dispatch(setModo(op.valor))}
            aria-pressed={modo === op.valor}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              modo === op.valor
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:text-foreground",
            )}
          >
            {op.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          aria-label={modo === "rango" ? "Fecha desde" : "Fecha"}
          value={rango.desde}
          onChange={(e) => dispatch(setDesde(e.target.value))}
          className="h-8 flex-1 bg-secondary text-xs font-medium"
        />
        {modo === "rango" && (
          <>
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date"
              aria-label="Fecha hasta"
              min={rango.desde}
              value={rango.hasta}
              onChange={(e) => dispatch(setHasta(e.target.value))}
              className="h-8 flex-1 bg-secondary text-xs font-medium"
            />
          </>
        )}
      </div>
    </div>
  );
}
