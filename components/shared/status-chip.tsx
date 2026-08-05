import { cn } from "@/lib/utils";
import { ESTADO } from "@/lib/status";
import type { EstadoVisible } from "@/types";

/** Chip de estado de una cuota. "Vencido" es derivado, no viene de la DB. */
export function StatusChip({ estado, className }: { estado: EstadoVisible; className?: string }) {
  const meta = ESTADO[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap",
        meta.chip,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
