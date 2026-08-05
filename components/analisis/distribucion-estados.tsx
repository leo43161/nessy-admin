import { cn } from "@/lib/utils";
import { ESTADO } from "@/lib/status";
import type { EstadoVisible } from "@/types";

/** Píldoras con la cantidad de cuotas en cada estado */
export function DistribucionEstados({
  datos,
}: {
  datos: Array<{ estado: EstadoVisible; cantidad: number }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {datos.map(({ estado, cantidad }) => {
        const meta = ESTADO[estado];
        return (
          <div
            key={estado}
            className={cn(
              "flex min-w-24 flex-1 items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2",
              meta.chip,
            )}
          >
            <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
            <div className="min-w-0">
              <div className="truncate text-[0.63rem] font-semibold tracking-[0.04em] uppercase opacity-80">
                {meta.label}
              </div>
              <div className="font-mono text-base leading-tight font-bold">{cantidad}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
