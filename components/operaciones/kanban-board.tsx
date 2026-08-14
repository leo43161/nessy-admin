"use client";

import { cn } from "@/lib/utils";
import { ESTADO } from "@/lib/status";
import { fmtMoney } from "@/lib/format";
import { ESTADOS_VISIBLES } from "@/lib/agregados";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { CuotaCard } from "@/components/operaciones/cuota-card";
import type { ColumnaCobrador } from "@/types";

/**
 * Kanban de cuotas: una columna por cobrador, scroll horizontal con snap.
 * En escritorio entran varias columnas; en móvil se desliza de a una.
 */
export function KanbanBoard({
  columnas,
  hoy,
  onSeleccionar,
  onReclamado,
}: {
  columnas: ColumnaCobrador[];
  hoy: string;
  onSeleccionar?: (cobroId: number) => void;
  onReclamado?: () => void;
}) {
  return (
    <div className="scrollbar-thin flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-4">
      {columnas.map((col) => (
        <section
          key={col.cobradorId}
          aria-label={`Cuotas de ${col.nombre}`}
          className="w-[265px] shrink-0 snap-start rounded-2xl border-[1.5px] border-border bg-card shadow-sm sm:w-[300px]"
        >
          <header className="flex items-center gap-2.5 rounded-t-2xl border-b-[1.5px] border-border bg-secondary p-3.5 pb-2.5">
            <InitialsAvatar nombre={col.nombre} color={col.color} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{col.nombre}</div>
              <div className="mt-0.5 font-mono text-[0.72rem] font-bold text-primary-dark">
                {fmtMoney(col.montoEsperado)} esperado
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {ESTADOS_VISIBLES.filter((e) => col.conteo[e] > 0).map((e) => (
                  <span
                    key={e}
                    title={ESTADO[e].label}
                    className={cn(
                      "rounded border px-1.5 py-px text-[0.65rem] font-semibold",
                      ESTADO[e].chip,
                    )}
                  >
                    {col.conteo[e]}
                    {ESTADO[e].icono}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <div className="flex flex-col gap-2 p-2.5">
            {col.cobros.map((cobro) => (
              <CuotaCard
                key={cobro.id}
                cobro={cobro}
                hoy={hoy}
                onClick={onSeleccionar ? () => onSeleccionar(cobro.cliente.id) : undefined}
                onReclamado={onReclamado}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
